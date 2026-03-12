import type {
  FounderValueMeasurement,
  FounderValueMetricsSummaryDto,
  FounderValueMeasurementSource,
  OperatorMetricsReportDto,
  ProductMetricsSnapshotDto,
} from '@venture-advisor-os/shared-types';

import {
  createProductMetricsService,
  type ProductMetricsArtifactIndex,
  type ProductMetricsRepositories,
  type ProductMetricsService,
} from './product-metrics.js';

export interface OperatorMetricsReportRepositories
  extends ProductMetricsRepositories {
  founderValueMeasurements: {
    listAll(): Promise<FounderValueMeasurement[]>;
  };
}

export interface OperatorMetricsReportServiceDependencies {
  repositories: OperatorMetricsReportRepositories;
  artifactIndex?: ProductMetricsArtifactIndex;
  productMetricsService?: ProductMetricsService;
  now?: () => Date;
}

export interface OperatorMetricsReportService {
  collect(): Promise<OperatorMetricsReportDto>;
}

export function createOperatorMetricsReportService(
  dependencies: OperatorMetricsReportServiceDependencies,
): OperatorMetricsReportService {
  const now = dependencies.now ?? (() => new Date());
  const productMetricsService =
    dependencies.productMetricsService ??
    createProductMetricsService({
      repositories: dependencies.repositories,
      artifactIndex: dependencies.artifactIndex,
      now,
    });

  return {
    async collect() {
      const [productMetrics, founderValueMeasurements] = await Promise.all([
        productMetricsService.collect(),
        dependencies.repositories.founderValueMeasurements.listAll(),
      ]);

      return {
        generatedAt: now().toISOString(),
        productMetrics,
        founderValue: summarizeFounderValueMeasurements(founderValueMeasurements),
      };
    },
  };
}

function summarizeFounderValueMeasurements(
  measurements: readonly FounderValueMeasurement[],
): FounderValueMetricsSummaryDto {
  if (measurements.length === 0) {
    return {
      measurementCount: 0,
      averagePerceivedUsefulnessScore: 0,
      averageConfidenceIncreaseScore: 0,
      averageManualResearchMinutesSaved: 0,
      byRespondentType: {
        OPERATOR: 0,
        FOUNDER: 0,
      },
    };
  }

  const byRespondentType = measurements.reduce<
    Record<FounderValueMeasurementSource, number>
  >(
    (counts, measurement) => {
      counts[measurement.respondentType] += 1;
      return counts;
    },
    {
      OPERATOR: 0,
      FOUNDER: 0,
    },
  );
  const latestMeasurementAt = [...measurements]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1)?.createdAt;

  return {
    measurementCount: measurements.length,
    averagePerceivedUsefulnessScore: average(
      measurements.map((measurement) => measurement.perceivedUsefulnessScore),
    ),
    averageConfidenceIncreaseScore: average(
      measurements.map((measurement) => measurement.confidenceIncreaseScore),
    ),
    averageManualResearchMinutesSaved: average(
      measurements.map((measurement) => measurement.manualResearchMinutesSaved),
    ),
    latestMeasurementAt,
    byRespondentType,
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export type { ProductMetricsSnapshotDto };
