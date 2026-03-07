import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import userRoutes from './routes/user';
import projectsRoutes from './routes/projects';
import reposRoutes from './routes/repos';
import branchesRoutes from './routes/branches';
import pullsRoutes from './routes/pulls';
import contentsRoutes from './routes/contents';
import latexRoutes from './routes/latex';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*',
  allowedHeaders: '*',
  exposedHeaders: ['X-Github-Token'],
}));

app.use(express.json({ limit: '10mb' }));

app.use(userRoutes);
app.use(projectsRoutes);
app.use(reposRoutes);
app.use(branchesRoutes);
app.use(pullsRoutes);
app.use(contentsRoutes);
app.use(latexRoutes);

app.use(errorHandler);

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Paperflow running on http://localhost:${PORT}`);
});
