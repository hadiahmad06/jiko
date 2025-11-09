// server.ts
import dotenv from 'dotenv';
import createApp from './app.js';

dotenv.config();
const PORT = process.env.PORT || 3000;

console.log('IS_OFFLINE:', process.env.IS_OFFLINE);
console.log('PORT:', process.env.PORT);

(async () => {
  const app = await createApp();
//   if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
//   }
})();



