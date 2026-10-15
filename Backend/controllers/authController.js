import User from '../models/user_model.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// jwt token
const generateToken = (res,payload)=>{
    const token = jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:'id'});
    res.cookie("token",token,{
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:"strict",
        maxAge:24*60*60*1000
    });
    return token;
}

//register
export const registerUser = async (req,res)=>{
    try{
        const {name,email,password} = res.body;
        if(!name || !email || !password){
            return res.json({message:"Please fill all the fields", success:false});
        }
        const existingUser = await User.findOne({emil});
        if(existingUser){
            return res.json({message:"User already exists",success:false})
        }
        const hashsedPassword = await bcrypt.hash(password,10);
        const user = await User.create({name,email,password:hashsedPassword});
        return res.json({message:"User registered successfully",success:true});
    }catch(error){
        console.log(error.message);
        return res.json({message:"internal server error",success:false});
    }
}

//user login
export const loginUser = async(req,res)=>{
    try{
        const {email,password}= req.body;
        if(!email || !password){
            return res.json({message:"Please fill all the fields"});
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch)return res.json({message:"Invalide credentials",success:false});
        generateToken(res,{id:user._id, role:user.isAdmin?"admin":"user"});

        res.json({
            message:"User logged in succefully",
            success:true,
            user:{
                name:user.name,
                email:user.email
            }
        })
    }catch(error){
        console.log(error.message);
        return res.json({message:"internal server error",success:false});
    }
}

//adin login
export const adminLogin = async(req,res)=>{
    try{
        const{email,password} = req.body;
        if(!email || !password){
            return res.json({message:"Please fill all the fields",success:false});
        }
        const adminEmail=process.env.ADMIN_EMAIL;
        const adminPassword=process.env.ADMIN_EMAIL;

        if(email!==adminEmail || password!==adminPassword){
            return res.json({message:"Invalide creentials", success:false});
        }

        const token = jwt.sign({email},process.env.JWT,{
            expiresIn:"1d"
        })
        res.cookie("token",token,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            sameSite:"strict",
            maxAge:24*60*60*1000
        });

        return res.json({message:"Admin logged in successfully",success:true});

    }catch(error){
        console.log(error.message);
        return res.json({message:"internal server error",success:false});
    }
}

//logout
export const logoutUser = async(req,res)=>{
    try{
        res.clearCookie("token");
        return res.json({message:"User logged out successfully"});
    }catch(error){
        console.log(error.message);
        return res.json({message:"internal server error",success:false});
    }
}
