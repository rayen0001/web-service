package main

import (
	"bufio"
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"
	"net/http"
	"time"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/handler"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDB connection string
const MONGO_URI = "mongodb://localhost:27017/feedback"

// Feedback data structure
type Feedback struct {
	Name            string    `bson:"name"`
	Email           string    `bson:"email"`
	FeedbackType    string    `bson:"feedbackType"`
	Service         string    `bson:"service"`
	Message         string    `bson:"message"`
	Rating          int       `bson:"rating"`
	AttachScreenshot bool     `bson:"attachScreenshot"`
	AgreeToTerms    bool      `bson:"agreeToTerms"`
	CreatedAt       time.Time `bson:"createdAt"`
}

// Global variables
var badWords []string
var mongoClient *mongo.Client
var feedbackCollection *mongo.Collection

// Define FeedbackInputType for use in mutations
var feedbackInputType = graphql.NewInputObject(graphql.InputObjectConfig{
	Name: "FeedbackInput",
	Fields: graphql.InputObjectConfigFieldMap{
		"name":             &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		"email":            &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		"feedbackType":     &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		"service":          &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		"message":          &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.String)},
		"rating":           &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.Int)},
		"attachScreenshot": &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.Boolean)},
		"agreeToTerms":     &graphql.InputObjectFieldConfig{Type: graphql.NewNonNull(graphql.Boolean)},
	},
})

// GraphQL schema for feedback output
var feedbackType = graphql.NewObject(graphql.ObjectConfig{
	Name: "Feedback",
	Fields: graphql.Fields{
		"name":             &graphql.Field{Type: graphql.String},
		"email":            &graphql.Field{Type: graphql.String},
		"feedbackType":     &graphql.Field{Type: graphql.String},
		"service":          &graphql.Field{Type: graphql.String},
		"message":          &graphql.Field{Type: graphql.String},
		"rating":           &graphql.Field{Type: graphql.Int},
		"attachScreenshot": &graphql.Field{Type: graphql.Boolean},
		"agreeToTerms":     &graphql.Field{Type: graphql.Boolean},
		"createdAt":        &graphql.Field{Type: graphql.String},
	},
})

// GraphQL Mutation for approving feedback
var approveFeedbackMutation = &graphql.Field{
	Type: graphql.NewObject(graphql.ObjectConfig{
		Name: "ApprovalResponse",
		Fields: graphql.Fields{
			"approved": &graphql.Field{Type: graphql.Boolean},
			"reason":   &graphql.Field{Type: graphql.String},
		},
	}),
	Args: graphql.FieldConfigArgument{
		"feedback": &graphql.ArgumentConfig{
			Type: feedbackInputType, // Use the input type here
		},
	},
	Resolve: func(p graphql.ResolveParams) (interface{}, error) {
		// Retrieve the feedback data
		feedbackData, ok := p.Args["feedback"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid feedback data format")
		}

		// Extract email and message for validation
		email, _ := feedbackData["email"].(string)
		message, _ := feedbackData["message"].(string)

		// Check for spam (more than 5 submissions in the last 5 minutes)
		isSpam, err := checkForSpam(email)
		if err != nil {
			return nil, fmt.Errorf("error checking for spam: %v", err)
		}
		if isSpam {
			return map[string]interface{}{
				"approved": false,
				"reason":   "Too many submissions in a short time period. Please try again later.",
			}, nil
		}

		// Check if message contains any bad words
		if containsBadWords(message) {
			return map[string]interface{}{
				"approved": false,
				"reason":   "Inappropriate language detected in the feedback message.",
			}, nil
		}

		// Otherwise, approve the feedback
		return map[string]interface{}{
			"approved": true,
			"reason":   "Feedback approved.",
		}, nil
	},
}

// Helper function to check if a message contains bad words
func containsBadWords(message string) bool {
	message = strings.ToLower(message)

	// Check for each bad word
	for _, badWord := range badWords {
		if strings.Contains(message, badWord) {
			return true
		}
	}

	return false
}

// Function to check if a user has submitted more than 5 feedbacks in the last 5 minutes
func checkForSpam(email string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Define the time threshold (5 minutes ago)
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute)

	// Count recent submissions from this email
	count, err := feedbackCollection.CountDocuments(ctx, bson.M{
		"email":     email,
		"createdAt": bson.M{"$gte": fiveMinutesAgo},
	})

	if err != nil {
		return false, err
	}

	// If count is 5 or more, consider it spam
	return count >= 5, nil
}

// Function to load bad words from a file
func loadBadWords() error {
	file, err := os.Open("bw.txt")
	if err != nil {
		return err
	}
	defer file.Close()

	// Reading the file line by line
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		badWords = append(badWords, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}

// Function to connect to MongoDB
func connectToMongoDB() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Set client options and connect
	clientOptions := options.Client().ApplyURI(MONGO_URI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return err
	}

	// Check the connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return err
	}

	// Set global variables
	mongoClient = client
	feedbackCollection = client.Database("feedback").Collection("feedbacks")

	fmt.Println("Connected to MongoDB!")
	return nil
}

// Function to generate GraphQL schema file
func generateSchemaFile(schema *graphql.Schema) error {
	// Create SDL (Schema Definition Language) string
	schemaSDL := `
# Input type for feedback submission
input FeedbackInput {
  name: String!
  email: String!
  feedbackType: String!
  service: String!
  message: String!
  rating: Int!
  attachScreenshot: Boolean!
  agreeToTerms: Boolean!
}

# Response type for feedback approval
type ApprovalResponse {
  approved: Boolean!
  reason: String
}

# Feedback type for output
type Feedback {
  name: String
  email: String
  feedbackType: String
  service: String
  message: String
  rating: Int
  attachScreenshot: Boolean
  agreeToTerms: Boolean
  createdAt: String
}

# Query root type
type Query {
  _dummy: String
}

# Mutation root type
type Mutation {
  approveFeedback(feedback: FeedbackInput!): ApprovalResponse!
}

# Schema definition
schema {
  query: Query
  mutation: Mutation
}
`

	// Write to schema.graphql file
	err := ioutil.WriteFile("schema.graphql", []byte(schemaSDL), 0644)
	if err != nil {
		return fmt.Errorf("failed to write schema file: %v", err)
	}

	fmt.Println("Generated schema.graphql file successfully!")
	return nil
}

func main() {
	// Load bad words from the bw.txt file
	err := loadBadWords()
	if err != nil {
		log.Fatalf("Failed to load bad words: %v", err)
	}

	// Connect to MongoDB
	err = connectToMongoDB()
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		mongoClient.Disconnect(ctx)
	}()

	// Define the root mutation
	var mutation = graphql.NewObject(graphql.ObjectConfig{
		Name: "Mutation",
		Fields: graphql.Fields{
			"approveFeedback": approveFeedbackMutation,
		},
	})

	// Define the schema
	var schema, schemaErr = graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name: "Query",
			Fields: graphql.Fields{
				"_dummy": &graphql.Field{
					Type: graphql.String,
					Resolve: func(p graphql.ResolveParams) (interface{}, error) {
						return "dummy", nil
					},
				},
			},
		}),
		Mutation: mutation,
	})
	
	if schemaErr != nil {
		log.Fatalf("Failed to create schema: %v", schemaErr)
	}

	// Generate schema.graphql file
	err = generateSchemaFile(&schema)
	if err != nil {
		log.Fatalf("Failed to generate schema file: %v", err)
	}

	// GraphQL handler
	http.Handle("/graphql", handler.New(&handler.Config{
		Schema: &schema,
		Pretty: true,
	}))

	// Start the server
	fmt.Println("Go GraphQL Server running on http://localhost:3000/graphql")
	log.Fatal(http.ListenAndServe(":3000", nil))
}