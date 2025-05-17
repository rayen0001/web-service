import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackAnalysisService } from '../services/feedback-analysis.service';
import { FeedbackService } from '../services/feedback.service';

interface KeyValuePair {
  key: string;
  value: number;
}

interface FeedbackAnalysis {
  averageRating: number;
  totalFeedback: number;
  feedbackTypeCounts: KeyValuePair[];
  sentimentCounts: KeyValuePair[];
}

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface ServiceAnalysis {
  service: string;
  totalFeedback: number;
  averageRating: number;
  averageSentiment: number;
  sentimentBreakdown: SentimentBreakdown;
  topKeywords: string[];
}

@Component({
  selector: 'app-feedback-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-dashboard.component.html',
  styleUrls: ['./feedback-dashboard.component.scss'],
})
export class FeedbackDashboardComponent implements OnInit {
  feedbackAnalysis: FeedbackAnalysis | null = null;
  serviceAnalysis: ServiceAnalysis | null = null;
  services: { id: string; name: string }[] = [];
  selectedService: string = '';
  isLoading: boolean = false;
  isServiceLoading: boolean = false;

  constructor(
    private feedbackAnalysisService: FeedbackAnalysisService,
    private feedbackService: FeedbackService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.isLoading = true;
    
    // Load services and overall feedback analysis in parallel
    Promise.all([
      this.loadServicesPromise(),
      this.loadFeedbackAnalysisPromise()
    ]).then(() => {
      this.isLoading = false;
    }).catch(err => {
      console.error('Failed to load initial data', err);
      this.isLoading = false;
    });
  }

  private loadServicesPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.feedbackService.getServices().subscribe({
        next: (data) => {
          this.services = data;
          if (this.services.length > 0) {
            this.selectedService = this.services[0].id;
            this.loadServiceAnalysis();
          }
          resolve();
        },
        error: (err) => {
          console.error('Failed to load services', err);
          reject(err);
        },
      });
    });
  }

  private loadFeedbackAnalysisPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.feedbackAnalysisService.getFeedbackAnalysis().subscribe({
        next: (analysis: FeedbackAnalysis | null) => {
          this.feedbackAnalysis = analysis;
          resolve();
        },
        error: (err: any) => {
          console.error('Failed to load feedback analysis:', err);
          reject(err);
        },
      });
    });
  }

  onServiceChange(): void {
    this.loadServiceAnalysis();
  }

  loadServiceAnalysis(): void {
    if (this.selectedService) {
      this.isServiceLoading = true;
      this.feedbackAnalysisService.getServiceAnalysis(this.selectedService).subscribe({
        next: (analysis: ServiceAnalysis | null) => {
          this.serviceAnalysis = analysis;
          this.isServiceLoading = false;
        },
        error: (err: any) => {
          console.error('Failed to load service analysis:', err);
          this.isServiceLoading = false;
        },
      });
    }
  }

  getSentimentClass(sentiment: string): string {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'sentiment-positive';
      case 'negative':
        return 'sentiment-negative';
      default:
        return 'sentiment-neutral';
    }
  }

  calculatePercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }
}