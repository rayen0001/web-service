import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FeedbackService } from "../services/feedback.service";

@Component({
  selector: "app-feedback-form",

  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./feedback-form.component.html",
  styleUrls: ["./feedback-form.component.scss"],
  providers: [FeedbackService] // Optional, or provide globally
})
export class FeedbackFormComponent implements OnInit {
  feedbackForm!: FormGroup;
  submitted = false;
  success = false;
  loading = false;
  errorMessage = "";
  // State for rejection status
  rejected = false;
  rejectionReason = "";

  feedbackTypes = [
    { id: "suggestion", name: "Suggestion" },
    { id: "bug", name: "Bug Report" },
    { id: "praise", name: "Praise" },
    { id: "complaint", name: "Complaint" },
  ];

  services: { id: string, name: string }[] = [];

  constructor(private fb: FormBuilder, private feedbackService: FeedbackService) {}

  ngOnInit(): void {
    this.initForm();
    this.loadServices();
  }

  initForm(): void {
    this.feedbackForm = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(2)]],
      email: ["", [Validators.required, Validators.email]],
      feedbackType: ["suggestion", Validators.required],
      service: ["", Validators.required],
      message: ["", [Validators.required, Validators.minLength(10)]],
      rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      attachScreenshot: [false],
      agreeToTerms: [false, Validators.requiredTrue],
    });
  }

  get f() {
    return this.feedbackForm.controls;
  }

  loadServices(): void {
    this.feedbackService.getServices().subscribe({
      next: (data) => {
        console.log(data);
        
        this.services = data;
        // Set default service once loaded
        if (this.services.length > 0) {
          this.feedbackForm.patchValue({ service: this.services[0].id });
        }
      },
      error: (err) => {
        console.error("Failed to load services", err);
        this.errorMessage = "Unable to load services.";
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = "";
    this.rejected = false; // Reset rejection status
    
    if (this.feedbackForm.invalid) {
      const firstError = document.querySelector('.is-invalid');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    this.loading = true;
    console.log(this.feedbackForm.value);
    

    this.feedbackService.submitFeedback(this.feedbackForm.value).subscribe({
      next: (response) => {
        console.log("Feedback submitted:", response);
        this.success = true;
        this.loading = false;
      },
      error: (err) => {
        console.error("Submission error:", err);
        this.loading = false;
        
        // Enhanced error handling for rejection
        // Look for rejection keywords in different parts of the error object
        const errorMessage = err.message || '';
        const graphQLErrors = err.graphQLErrors || [];
        const networkError = err.networkError || {};
        
        // Check various places where the rejection message might be
        if (
          errorMessage.includes('rejected') || 
          (networkError && networkError.message && networkError.message.includes('rejected')) ||
          graphQLErrors.some((e: any) => e.message && e.message.includes('rejected'))
        ) {
          this.rejected = true;
          
          // Try to extract the rejection reason from various possible locations
          let reason = '';
          
          // Check in the main error message
          if (errorMessage.includes('Feedback rejected')) {
            // Extract text after "Feedback rejected"
            const match = errorMessage.match(/Feedback rejected[,:]?\s*(.*)/i);
            reason = match && match[1] ? match[1] : '';
          }
          
          // Check in GraphQL errors
          if (!reason && graphQLErrors.length) {
            const rejectionError = graphQLErrors.find((e: any) => 
              e.message && e.message.includes('rejected')
            );
            if (rejectionError) {
              reason = rejectionError.message;
            }
          }
          
          // If we found a specific reason, use it; otherwise use default
          this.rejectionReason = reason || "Your feedback couldn't be accepted at this time.";
          
          // Clean up the rejection reason if needed
          if (this.rejectionReason.includes('email sent to the user')) {
            this.rejectionReason = "Your feedback couldn't be processed. Please check your email for details.";
          }
        } else {
          // Generic error
          this.errorMessage = "An error occurred while submitting feedback. Please try again later.";
        }
      }
    });
  }

  resetForm(): void {
    this.submitted = false;
    this.success = false;
    this.rejected = false;
    this.errorMessage = "";
    this.rejectionReason = "";
    this.initForm();
    if (this.services.length > 0) {
      this.feedbackForm.patchValue({ service: this.services[0].id });
    }
  }

  setRating(rating: number): void {
    this.feedbackForm.patchValue({ rating: rating });
  }

  tryAgain(): void {
    this.rejected = false;
    this.submitted = false; // Reset submitted state
    this.loading = false;
    // Keep the form data for editing
  }
}