/**
 * @fileoverview SkillRadarChart - Multi-axis visualization of employee skills.
 * 
 * Uses Chart.js to render a radar (spider) chart showing proficiency levels
 * for a given list of skills. Supports dark mode and dynamic skill list updates.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import type { SkillRadarChartProps, EmployeeSkill } from '../types';

// Register radar chart components for Chart.js
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

/**
 * Component that renders a radar chart for a set of skill proficiency levels.
 *
 * @component
 * @param {Object}   props          - Component props.
 * @param {Object[]} props.skills   - Array of skill objects { skillName, proficiencyLevel }.
 * @param {boolean}  [props.darkMode=false] - Whether to render in dark mode.
 * @param {string}   [props.title="Skill Proficiency"] - Chart header title.
 * @returns {JSX.Element} The radar chart and skill breakdown list.
 */
const SkillRadarChart: React.FC<SkillRadarChartProps> = ({ skills, darkMode = false, title = "Skill Proficiency" }) => {
  const chartRef = useRef<any>(null);
  const chartInstance = useRef<any>(null);
  const [showAll, setShowAll] = useState<boolean>(false);

  useEffect(() => {
    if (!chartRef.current || !skills || skills.length === 0) return;

    // Destroy previous chart if exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');

    // Prepare and normalize data - USE ALL SKILLS
    const allSkills = Array.isArray(skills) ? skills : [];
    
    const skillNames = allSkills.map((s: any) => s.skillName || s.name || 'Unknown');
    const proficiencies = allSkills.map((s: any) => {
      const val = s.proficiencyLevel || 0;
      return Number(val) > 5 ? 5 : Number(val); // clamp to max 5
    });

    // Color scheme based on theme
    const primaryColor = darkMode ? 'rgba(139, 92, 246, 0.4)' : 'rgba(99, 102, 241, 0.4)';
    const borderColor = darkMode ? 'rgba(167, 139, 250, 1)' : 'rgba(99, 102, 241, 1)';
    const gridColor = darkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    const angleLineColor = darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
    const textColor = darkMode ? '#e5e7eb' : '#374151';

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: skillNames,
        datasets: [{
          label: 'Proficiency Level',
          data: proficiencies,
          backgroundColor: primaryColor,
          borderColor: borderColor,
          borderWidth: 3,
          pointBackgroundColor: borderColor,
          pointBorderColor: darkMode ? '#1f2937' : '#fff',
          pointBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: darkMode ? '#a78bfa' : '#6366f1',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 5,
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: textColor,
              backdropColor: 'transparent',
              font: {
                size: 12,
                weight: 600 as const
              },
              showLabelBackdrop: false,
              z: 1
            },
            grid: {
              color: gridColor,
              lineWidth: 2,
              circular: true
            },
            angleLines: {
              color: angleLineColor,
              lineWidth: 2
            },
            pointLabels: {
              color: textColor,
              font: {
                size: 13,
                weight: 'bold'
              },
              padding: 15
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: darkMode ? '#f3f4f6' : '#1f2937',
            bodyColor: darkMode ? '#e5e7eb' : '#374151',
            borderColor: darkMode ? 'rgba(167, 139, 250, 0.5)' : 'rgba(99, 102, 241, 0.5)',
            borderWidth: 2,
            padding: 12,
            displayColors: false,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              title: (items: any[]) => items[0].label,
              label: (context: any) => `Level: ${context.parsed.r}/5`
            }
          }
        },
        elements: {
          line: {
            tension: 0.1
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [skills, darkMode]);

  if (!skills || skills.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg ${
        darkMode 
          ? 'bg-gray-800 border-gray-700 text-gray-400'
          : 'bg-gray-50 border-gray-300 text-gray-600'
      }`}>
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0
            a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-lg font-semibold">No Skills Available</p>
        <p className="text-sm mt-1">Add skills to see the radar chart</p>
      </div>
    );
  }

  return (
    <div className={`relative ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6`}>
      <h3 className={`text-lg font-bold mb-6 text-center ${
        darkMode ? 'text-gray-100' : 'text-gray-900'
      }`}>
        {title}
      </h3>

      {/* Centered Radar Chart */}
      <div className="flex justify-center items-center mb-6">
        <div className="relative w-full max-w-[400px]">
          <canvas ref={chartRef} />
        </div>
      </div>

      {/* Legend */}
      <div className={`mt-4 p-3 rounded-lg border ${
        darkMode 
          ? 'bg-gray-900/50 border-gray-700'
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
              Proficiency (1–5)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
              Total Skills: <strong className={darkMode ? 'text-gray-200' : 'text-gray-900'}>
                {skills.length}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Skill Breakdown */}
      <div className={`mt-4 text-xs ${
        darkMode ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <div className="grid grid-cols-2 gap-2">
          {skills.slice(0, showAll ? skills.length : 6).map((skill, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="truncate mr-2">{skill.skillName || skill.name}</span>
              <span className={`font-semibold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                {skill.proficiencyLevel || 0}/5
              </span>
            </div>
          ))}
        </div>
        {skills.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className={`mt-3 w-full py-2 rounded-lg transition ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {showAll ? 'Show Less' : `Show All ${skills.length} Skills`}
          </button>
        )}
      </div>
    </div>
  );
};

export default SkillRadarChart;