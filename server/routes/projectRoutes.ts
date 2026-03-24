import express from 'express';
import { protect } from '../middlewares/auth';
import { makeRevision, rollbackToVersion, saveProjectCode, deleteProject, getProjectPreview, 
getPublishedProject, getProjectById } from '../controllers/projectController';
import { togglePublish } from '../controllers/userController';

const projectRouter =  express.Router();

projectRouter.post('/revision/:projectId', protect, makeRevision);
projectRouter.put('/save/:projectId', protect, saveProjectCode);
projectRouter.get('/rollback/:projectId/:versionId', protect, rollbackToVersion);
projectRouter.delete('/:projectId', protect, deleteProject);
projectRouter.get('/preview/:projectId', protect, getProjectPreview);
projectRouter.get('/published/', getPublishedProject);
projectRouter.get('/published/:projectId', getProjectById);
projectRouter.get('/publish-toggle/:projectId', protect, togglePublish);

export default projectRouter;


