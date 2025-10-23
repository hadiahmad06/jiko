import express from 'express';
import updateRouter from './routes/update.js';
import loginRouter from './routes/auth/login.js';
import signupRouter from './routes/auth/signup.js';
import meRouter from './routes/auth/me.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/update', updateRouter);
app.use('/auth/login', loginRouter);
app.use('/auth/signup', signupRouter);
app.use('/auth/me', meRouter);

export default app;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
