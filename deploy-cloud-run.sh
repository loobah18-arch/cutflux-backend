#!/usr/bin/env bash
set -euo pipefail

# Deploy script for Cutflux Cloud Run Backend
PROJECT_ID="${GCP_PROJECT_ID:-videoediting-app}"
SERVICE_NAME="video-edit-portal"
REGION="${GCP_REGION:-us-central1}"

echo "==> Deploying $SERVICE_NAME to Google Cloud Run (Project: $PROJECT_ID, Region: $REGION)..."

gcloud config set project "$PROJECT_ID"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --max-instances 10 \
  --set-env-vars "PORT=8080,VEP_ADMIN_UNLOCK_PIN=8842"

echo "==> Deployment complete!"
