const User = require('../models/User');

// Get all users (excluding secret_key for security)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, { secret_key: 0 });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// Get user by ID (including secret_key for kite object creation)
const getUserById = async (req, res) => {
    try {
        const user = await User.findOne({ user_id: req.params.userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

// Create a new user
const createUser = async (req, res) => {
    try {
        const { name, api_key, secret_key, access_token } = req.body;
        const user = new User({
            name,
            api_key,
            secret_key,
            access_token
        });
        await user.save();
        res.status(201).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const { name, api_key, secret_key, access_token } = req.body;
        const user = await User.findOneAndUpdate(
            { user_id: req.params.userId },
            { name, api_key, secret_key, access_token },
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ user_id: req.params.userId });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
}; 