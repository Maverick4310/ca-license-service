import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import licenseRoutes from './routes/licenses.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/licenses', licenseRoutes);

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server running on ${port}`);
});
