import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = express();
console.log(`Server running on port ${PORT}`);

server.use(express.json());

server.use(express.urlencoded({ extended: true }));

server.use('/auth', authRoutes);
server.use('/calendar', calendarRoutes);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
