import express from 'express';
import updateRouter from './routes/update.js';
import authRouter from './routes/auth.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/', updateRouter);
app.use('/', authRouter);

export default app;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
