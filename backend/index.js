const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// routes
app.use('/startApp', require('./src/routes/startApp'));
app.use('/stopApp', require('./src/routes/stopApp'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));