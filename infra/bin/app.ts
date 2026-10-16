#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FamilyTriviaStack } from '../lib/family-trivia-stack';

const app = new cdk.App();

new FamilyTriviaStack(app, 'FamilyTriviaStack', {
  env: {
    region: 'us-east-1',
  },
});
