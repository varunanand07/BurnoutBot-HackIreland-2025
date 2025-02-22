
import express from 'express';
import dotenv from 'dotenv';


dotenv.config();  


const PORT = process.env.PORT || 4000;


const server = express();


console.log(`Using port: ${PORT}`);


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
