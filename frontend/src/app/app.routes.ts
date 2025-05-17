import { Routes } from '@angular/router';
import { FeedbackFormComponent } from './feedback-form/feedback-form.component';
import { FeedbackDashboardComponent } from './feedback-dashboard/feedback-dashboard.component';

export const routes: Routes = [
    {path:"",component:FeedbackFormComponent},
    {path:"feed",component:FeedbackDashboardComponent},

];
