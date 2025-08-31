# Strategy HQ - User Selection Frontend

A modern, responsive web application for user selection and session management built with MVC (Model-View-Controller) architecture. Users can select from a list of available users in the database, and their credentials (api_key, secret_key, access_token) are stored in session storage for further use with kite objects.

## Features

- **Modern UI**: Beautiful, responsive design with gradient backgrounds and smooth animations
- **User Selection**: Dropdown list of available users from the database
- **Session Storage**: User credentials are stored in browser session storage
- **Real-time Feedback**: Loading states, success/error messages
- **Persistent Sessions**: Remembers selected user across page refreshes
- **Security**: Sensitive data handling with proper API endpoints
- **MVC Architecture**: Modular, maintainable code structure
- **CORS Enabled**: Cross-Origin Resource Sharing configured for frontend-backend communication

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd prod-core-ap-south-1-strategy-hq
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_atlas_connection_string
   PORT=3000
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

- `GET /` - Serves the main application page
- `GET /api/users` - Returns all users (excludes secret_key for security)
- `GET /api/users/:userId` - Returns complete user data including secret_key
- `POST /api/users` - Creates a new user
- `PUT /api/users/:userId` - Updates a user
- `DELETE /api/users/:userId` - Deletes a user

## Project Structure (MVC Architecture)

```
├── config/
│   └── database.js          # Database connection configuration
├── controllers/
│   └── userController.js    # User business logic
├── middleware/
│   └── errorHandler.js      # Error handling middleware
├── models/
│   └── User.js             # User data model
├── routes/
│   ├── index.js            # Main routes aggregator
│   └── userRoutes.js       # User-specific routes
├── views/
│   └── index.html          # Template for server-side rendering
├── public/
│   └── index.html          # Main frontend application
├── server.js               # Application entry point
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## MVC Architecture Components

### Models (`/models`)
- **User.js**: Defines the user data structure and database schema
- Handles data validation and database operations

### Views (`/views` & `/public`)
- **public/index.html**: Main frontend application
- **views/**: Templates for potential server-side rendering

### Controllers (`/controllers`)
- **userController.js**: Contains all user-related business logic
- Handles HTTP requests and responses
- Manages data flow between models and views

### Routes (`/routes`)
- **userRoutes.js**: Defines API endpoints for user operations
- **index.js**: Aggregates all route modules

### Configuration (`/config`)
- **database.js**: MongoDB connection setup and configuration

### Middleware (`/middleware`)
- **errorHandler.js**: Centralized error handling and logging

## User Model

The User model includes:
- `user_id`: Unique identifier (auto-generated UUID)
- `name`: User's display name
- `api_key`: API key for kite integration
- `secret_key`: Secret key for kite integration
- `access_token`: Access token for kite integration
- `timestamps`: Created and updated timestamps

## Session Storage

When a user is selected, the following data is stored in browser session storage:
- `selectedUser`: Complete user object (JSON string)
- `user_id`: User ID
- `api_key`: API key
- `secret_key`: Secret key
- `access_token`: Access token

## Frontend Features

### UI Components
- **Gradient Background**: Modern purple gradient design
- **Glass Morphism**: Semi-transparent container with blur effect
- **Responsive Design**: Works on desktop and mobile devices
- **Interactive Elements**: Hover effects and smooth transitions

### JavaScript Functionality
- **Dynamic User Loading**: Fetches users from API on page load
- **Session Management**: Stores and retrieves user data from session storage
- **Error Handling**: Comprehensive error handling with user feedback
- **Loading States**: Visual feedback during API calls

## Security Considerations

- Secret keys are excluded from the general users list endpoint
- Complete user data (including secret_key) is only fetched when a user is selected
- Session storage is used for temporary credential storage
- API endpoints include proper error handling
- Centralized error handling middleware

## Benefits of MVC Architecture

1. **Separation of Concerns**: Clear separation between data, logic, and presentation
2. **Maintainability**: Easy to modify and extend individual components
3. **Testability**: Each component can be tested independently
4. **Scalability**: Easy to add new features and modules
5. **Code Reusability**: Controllers and models can be reused across different routes

## Next Steps

After user selection, the stored credentials can be used to:
1. Create kite objects for trading operations
2. Initialize trading strategies
3. Connect to trading APIs
4. Perform market analysis

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check your MONGO_URI in the .env file
- Verify network connectivity if using cloud MongoDB

### Port Already in Use
- Change the PORT in your .env file
- Or kill the process using the current port

### No Users Displayed
- Check the browser console for API errors
- Verify the server is running and accessible
- Ensure your MongoDB Atlas database has users

### CORS Issues
If you encounter CORS errors when the frontend tries to access the backend:

**Error Message**: `Access to fetch at 'http://localhost:3000/api/users' from origin 'http://localhost:5173' has been blocked by CORS policy`

**Solution**:
1. **CORS is now configured automatically** - The server includes CORS middleware by default
2. **Restart the backend server** after any changes to CORS configuration
3. **Check allowed origins** - The following origins are allowed by default:
   - `http://localhost:5173` (Vite dev server)
   - `http://localhost:3000` (Production frontend)
   - `http://127.0.0.1:5173` (Alternative localhost)
   - `http://127.0.0.1:3000` (Alternative localhost)

**Test CORS Configuration**:
```bash
node test-cors.js
```

**Custom CORS Origins**: Set the `CORS_ORIGINS` environment variable:
```bash
CORS_ORIGINS=http://localhost:5173,http://example.com,https://yourdomain.com
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the MVC pattern
4. Test thoroughly
5. Submit a pull request

## License

ISC License 