import express from 'express';
import startAppRouter from './routes/startApp.js';
import stopAppRouter from './routes/stopApp.js';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/startApp', startAppRouter);
app.use('/stopApp', stopAppRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));