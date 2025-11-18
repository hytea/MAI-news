import React from 'react';
import clsx from 'clsx';
import { BiasAnalysis, BiasLevel, SeverityLevel } from '../types';

interface BiasIndicatorProps {
  biasAnalysis: BiasAnalysis | null;
  loading?: boolean;
}

const getBiasColor = (bias: BiasLevel): string => {
  const colors: Record<BiasLevel, string> = {
    left: 'text-blue-600 bg-blue-50',
    'center-left': 'text-blue-400 bg-blue-50',
    center: 'text-gray-600 bg-gray-50',
    'center-right': 'text-red-400 bg-red-50',
    right: 'text-red-600 bg-red-50',
    unknown: 'text-gray-400 bg-gray-50',
  };
  return colors[bias] || colors.unknown;
};

const getBiasLabel = (bias: BiasLevel): string => {
  const labels: Record<BiasLevel, string> = {
    left: 'Left',
    'center-left': 'Center-Left',
    center: 'Center',
    'center-right': 'Center-Right',
    right: 'Right',
    unknown: 'Unknown',
  };
  return labels[bias] || 'Unknown';
};

const getSeverityColor = (severity: SeverityLevel): string => {
  const colors: Record<SeverityLevel, string> = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };
  return colors[severity];
};

export const BiasIndicator: React.FC<BiasIndicatorProps> = ({ biasAnalysis, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span>Analyzing bias...</span>
        </div>
      </div>
    );
  }

  if (!biasAnalysis) {
    return null;
  }

  const confidencePercentage = Math.round(biasAnalysis.confidence * 100);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Bias Analysis</h3>

      {/* Overall Bias */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Overall Bias:</span>
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium',
              getBiasColor(biasAnalysis.overallBias)
            )}
          >
            {getBiasLabel(biasAnalysis.overallBias)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full"
              style={{ width: `${confidencePercentage}%` }}
            ></div>
          </div>
          <span className="text-xs text-gray-500">{confidencePercentage}% confidence</span>
        </div>
      </div>

      {/* Bias Indicators */}
      {biasAnalysis.indicators && biasAnalysis.indicators.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Detected Indicators:</h4>
          <div className="space-y-2">
            {biasAnalysis.indicators.map((indicator, index) => (
              <div key={index} className="flex items-start gap-2">
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getSeverityColor(indicator.severity)
                  )}
                >
                  {indicator.severity}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{indicator.type}</p>
                  <p className="text-xs text-gray-600">{indicator.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative Perspectives */}
      {biasAnalysis.alternativePerspectives && biasAnalysis.alternativePerspectives.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Alternative Perspectives:</h4>
          <ul className="space-y-1">
            {biasAnalysis.alternativePerspectives.map((perspective, index) => (
              <li key={index} className="text-xs text-gray-700 pl-3 border-l-2 border-gray-300">
                {perspective}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
