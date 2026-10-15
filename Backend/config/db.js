import mongoose from 'mongoose';

const connectDB = async(req,res)=>{
    try{
        await mongoose.connect(process.env.MONGOOSE_URL);
        console.log("Database connected");
    }catch(error){
        console.log(`error in connecting databse ${error}`);
    }
}

export default connectDB;