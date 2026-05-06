import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as path from 'path';
import * as fs from 'fs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

// Load deployment config (secrets, domain, etc.)
// Copy cdk.context.example.json → cdk.config.json and fill in your values.
function loadConfig(): Record<string, string> {
  const configPath = path.join(__dirname, '../cdk.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      'Missing cdk/cdk.config.json — copy cdk.context.example.json and fill in your values.',
    );
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export class FamilyTriviaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const config = loadConfig();

    // ── S3 Buckets ───────────────────────────────────────────────────
    const triviaBucket = new s3.Bucket(this, 'TriviaDataBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // ── Lambda ───────────────────────────────────────────────────────
    const apiLambda = new NodejsFunction(this, 'TriviaApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/index.ts'),
      handler: 'handler',
      timeout: Duration.seconds(90),
      memorySize: 1769,
      bundling: {
        minify: true,
        sourceMap: false,
        target: 'es2020',
      },
      environment: {
        BUCKET_NAME: triviaBucket.bucketName,
        BEDROCK_MODEL_ID: config.bedrockModelId,
        NODE_ENV: 'production',
        JWT_SECRET: config.jwtSecret,
        GOOGLE_CLIENT_ID: config.googleClientId,
      },
    });

    triviaBucket.grantReadWrite(apiLambda);

    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:ListFoundationModels',
        'bedrock:GetFoundationModel',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}:*:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0`,
        `arn:aws:bedrock:${this.region}:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0`,
        '*',
      ],
    }));

    // ── API Gateway (HTTP API — lower latency, lower cost than REST API) ──
    // No CORS config needed — API is same-origin via CloudFront.
    const apiLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', apiLambda, {
      payloadFormatVersion: apigatewayv2.PayloadFormatVersion.VERSION_1_0,
    });

    const api = new apigatewayv2.HttpApi(this, 'TriviaHttpApi', {
      apiName: 'Family Trivia Service',
      defaultIntegration: lambdaIntegration,
    });

    // Configure the $default stage with access logging and throttling
    const defaultStage = api.defaultStage!.node.defaultChild as apigatewayv2.CfnStage;
    defaultStage.accessLogSettings = {
      destinationArn: apiLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        ip: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLength: '$context.responseLength',
        integrationLatency: '$context.integrationLatency',
      }),
    };
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: 50,
      throttlingRateLimit: 25,
    };

    // Grant CloudWatch write access for access logging
    apiLogGroup.grantWrite(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // ── Security headers (for static assets only) ────────────────────
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: 'FamilyTriviaSecHeaders',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    });

    // ── WAF ──────────────────────────────────────────────────────────
    const waf = new wafv2.CfnWebACL(this, 'SiteWAF', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'FamilyTriviaWAF',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'CommonRuleSet', sampledRequestsEnabled: true },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'KnownBadInputs', sampledRequestsEnabled: true },
        },
        {
          name: 'RateLimitPerIP',
          priority: 3,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RateLimitPerIP', sampledRequestsEnabled: true },
        },
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'IPReputation', sampledRequestsEnabled: true },
        },
      ],
    });

    // ── CloudFront — single domain for frontend + API ────────────────
    // Default behavior: S3 static assets (frontend)
    // /api/* behavior: API Gateway (same-origin, no CORS needed)
    // WAF protects BOTH frontend and API at the edge.

    // API Gateway origin — HTTP API has no stage prefix in URL
    const apiDomainName = `${api.apiId}.execute-api.${this.region}.amazonaws.com`;
    const apiOrigin = new origins.HttpOrigin(apiDomainName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // ── Custom domain (from cdk.config.json) ──────────────────────
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCert',
      config.certificateArn,
    );

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      domainNames: [config.customDomain],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
      },
      // API behavior — /api/* routes to API Gateway
      // Custom cache policy: no caching but forwards Authorization + query strings.
      // Managed-CachingDisabled strips all headers which breaks JWT auth.
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: new cloudfront.CachePolicy(this, 'ApiNoCachePolicy', {
            cachePolicyName: 'FamilyTriviaApiPassthrough',
            defaultTtl: Duration.seconds(0),
            maxTtl: Duration.seconds(1),
            minTtl: Duration.seconds(0),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: waf.attrArn,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });
    const siteUrl = distribution.distributionDomainName;

    // ── Frontend config — API is now same-origin at /api ─────────────
    const frontendConfig = {
      REACT_APP_API_URL: '/api',
      REACT_APP_SITE_URL: `https://${siteUrl}`,
      REACT_APP_AUDIO_URL: `https://${siteUrl}/audio`,
      REACT_APP_GOOGLE_CLIENT_ID: config.googleClientId,
    };

    // ── Deploy frontend ──────────────────────────────────────────────
    const buildPath = path.join(__dirname, '../../frontend/dist');
    const assetsPath = path.join(buildPath, 'assets');
    if (fs.existsSync(buildPath)) {
      // Hashed assets (JS/CSS) — immutable, cache for 1 year
      if (fs.existsSync(assetsPath)) {
        new s3deploy.BucketDeployment(this, 'DeployAssets', {
          sources: [s3deploy.Source.asset(assetsPath)],
          destinationBucket: siteBucket,
          destinationKeyPrefix: 'assets',
          distribution,
          distributionPaths: ['/assets/*'],
          cacheControl: [
            s3deploy.CacheControl.maxAge(Duration.days(365)),
            s3deploy.CacheControl.immutable(),
          ],
          prune: false, // don't delete old chunks until CloudFront cache expires
        });
      }

      // Root files (index.html, config.json, etc.) — always revalidate
      new s3deploy.BucketDeployment(this, 'DeployRoot', {
        sources: [
          s3deploy.Source.asset(buildPath, { exclude: ['assets', 'assets/**'] }),
          s3deploy.Source.jsonData('config.json', frontendConfig),
        ],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/index.html', '/config.json'],
        cacheControl: [s3deploy.CacheControl.noCache()],
        prune: false, // don't delete assets/ uploaded by DeployAssets
      });
    } else {
      new s3deploy.BucketDeployment(this, 'DeployConfigOnly', {
        sources: [s3deploy.Source.jsonData('config.json', frontendConfig)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/config.json'],
        cacheControl: [s3deploy.CacheControl.noCache()],
      });
    }

    // ── Outputs ──────────────────────────────────────────────────────
    new CfnOutput(this, 'SiteURL', { value: `https://${siteUrl}` });
    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'DataBucket', { value: triviaBucket.bucketName });
  }
}
