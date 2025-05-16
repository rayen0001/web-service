
export default () => ({
  port: parseInt(process.env.PORT!, 10) || 4000,
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/feedback',
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT!, 10) || 587,
    secure: process.env.EMAIL_PORT === '465',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
  goServiceUrl: process.env.GO_SERVICE_URL || 'http://localhost:3000/graphql',
});

