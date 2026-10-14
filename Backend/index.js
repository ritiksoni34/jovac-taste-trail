import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
dotenv.config();

const app = express();

// database connection

connectDB()

//middlewares
app.use(express.json());
app.use(cors());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.get('/',(req,res)=>{
    res.send("hello guys");
})

app.listen(PORT,()=>{
    console.log(`Server is running on ${PORT}`);
});
