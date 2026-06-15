import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './config/supabaseClient.js'
import postRoutes from './routes/postRoute.js'
dotenv.config();

const app = express();
//password = "j$JczU.nbKQq5-_"
app.use(cors());
app.use(express.json());

app.use('/api/posts', postRoutes)

async function testSupabaseConnection(){
    try {
        console.log('🔄 Testing connection...')
        const { data, error } = await supabase.auth.getSession()
        if (error){
            console.error('❌ Connection Failed:', error.message)
        }
        else{
            console.log('✅ Success! Connected to Supabase.')
            console.log('URL:', process.env.SUPABASE_URL);}
    } 
    catch (err){
        console.error('❌ Unexpected Error:', err.message)
    }}
testSupabaseConnection();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT)

});

