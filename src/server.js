<<<<<<< HEAD
import express from "express";
import dotenv from "dotenv";
import authRoutes from "../src/routes/authRoutes.js";
import calendarRoutes from "../src/routes/calendarRoutes.js";

dotenv.config();
=======

import express from 'express';
import dotenv from 'dotenv';


dotenv.config();  

>>>>>>> main

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth", authRoutes);
app.use("/calendar", calendarRoutes);

const PORT = process.env.PORT || 4000;
<<<<<<< HEAD
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
=======


const server = express();


console.log(`Using port: ${PORT}`);


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
>>>>>>> main
