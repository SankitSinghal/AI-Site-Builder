"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middlewares/auth");
const projectController_1 = require("../controllers/projectController");
const userController_1 = require("../controllers/userController");
const projectRouter = express_1.default.Router();
projectRouter.post('/revision/:projectId', auth_1.protect, projectController_1.makeRevision);
projectRouter.put('/save/:projectId', auth_1.protect, projectController_1.saveProjectCode);
projectRouter.get('/rollback/:projectId/:versionId', auth_1.protect, projectController_1.rollbackToVersion);
projectRouter.delete('/:projectId', auth_1.protect, projectController_1.deleteProject);
projectRouter.get('/preview/:projectId', auth_1.protect, projectController_1.getProjectPreview);
projectRouter.get('/published/', projectController_1.getPublishedProject);
projectRouter.get('/published/:projectId', projectController_1.getProjectById);
projectRouter.get('/publish-toggle/:projectId', auth_1.protect, userController_1.togglePublish);
exports.default = projectRouter;
