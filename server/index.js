import express from 'express';
import { connectDB } from './config/db.config.js';
import dotenv from 'dotenv'
dotenv.config({ quiet: true })
const app = express();

connectDB()
app.get('/', (req, res) => {
    res.send("<h1>This is MindVault dashboard -- Vaanakam bro</h1>");

});

app.listen(8000, () => {
    console.log("Server running on port 8000");
});