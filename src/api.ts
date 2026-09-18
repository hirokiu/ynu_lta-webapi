import express, { Application, Request, Response } from 'express';
import { Controller } from './main.controller';
import { MONGO_URL, NOTIFICATION_CHECK_INTERVAL_MS } from './constants/surveyApi.constants';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { CloudMessageService } from './services/cloudMessage.service';
import { SurveyService } from './services/surveyApi.service';

import { notificationsEnabled, preparationEnabled } from "./utils/runtimeFlags";

class Api {

    public api: Application;
    public surveyController: Controller;
    public cloudMessageService: CloudMessageService;
    public surveyService: SurveyService;

    constructor() {
        this.api = express();
        this.setConfig();
        this.setMongoConfig();
        this.surveyController = new Controller(this.api);

        // this.api.get('/', function(req,res) {
        //     res.sendFile('index.html', { root: path.join(__dirname, '../public/dist/') });
        // });

        this.cloudMessageService = new CloudMessageService();
        this.surveyService = new SurveyService();
        if (preparationEnabled() || notificationsEnabled()) this.startBackgroundRunner();
    }

    private setConfig() {
        this.api.use(bodyParser.json({ limit: '50mb' }));
        this.api.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
        this.api.use(cors());
        this.api.get("/api/health", (_req, res) => {
            const ready = mongoose.connection.readyState === 1;
            res.status(ready ? 200 : 503).json({ ready });
        });
    }

    private setMongoConfig() {
        mongoose.Promise = global.Promise;
        mongoose.connect(MONGO_URL, {
            useNewUrlParser: true,
            autoIndex: false
        });
    }

    private startBackgroundRunner() {
        setInterval(() => this.notifyAssignments(), NOTIFICATION_CHECK_INTERVAL_MS);
    }

    private notifyAssignments() {
        if (preparationEnabled()) this.surveyService.CreateImpendingResultObjects();
        if (!notificationsEnabled()) return;

        this.surveyService.FindRegistrationTokensForNotification(
            (deviceRegistrationToken: string, title: String, body: String) => {
                this.cloudMessageService.sendMessage(deviceRegistrationToken, title, body);
            }
        );
    }
}

export default new Api().api;