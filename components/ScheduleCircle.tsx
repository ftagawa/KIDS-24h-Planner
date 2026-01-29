import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Activity } from '../types';
import { toMinutes, fromMinutes } from '../utils';

interface ScheduleCircleProps {
  activities: Activity[];
  onTimeClick: (h: number, m: number) => void;
  onActivityClick: (activity: Activity) => void;
}

export const ScheduleCircle: React.FC<ScheduleCircleProps> = ({
  activities,
  onTimeClick,
  onActivityClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        // Maintain square aspect ratio or fit screen
        const size = Math.min(width, window.innerHeight * 0.7);
        setDimensions({ width: size, height: size });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width, height } = dimensions;
  const radius = Math.min(width, height) / 2 - 60; // Padding for labels and icons
  const innerRadius = 0; // Pie chart style

  // Memoize the drawing logic
  useEffect(() => {
    if (!svgRef.current || width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Scale: 0-1440 mins -> 0-2PI radians
    const angleScale = d3.scaleLinear().domain([0, 1440]).range([0, 2 * Math.PI]);

    // Arc generator - removed accessor functions so we can pass angles directly
    const arcGenerator = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .padAngle(0.005); // Small gap between slices

    // --- DRAW BACKGROUND CLOCK FACE ---

    // Circle border
    g.append('circle')
      .attr('r', radius)
      .attr('fill', '#fff')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2);

    // Hours markers and lines
    for (let h = 0; h < 24; h++) {
      const angle = angleScale(h * 60);
      const isMajor = h % 3 === 0;

      // Grid lines
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', Math.sin(angle) * radius)
        .attr('y2', -Math.cos(angle) * radius) // D3 0 is -y (up)
        .attr('stroke', isMajor ? '#cbd5e1' : '#f1f5f9')
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      // Labels (0-23)
      const labelRadius = radius + 25;
      const x = Math.sin(angle) * labelRadius;
      const y = -Math.cos(angle) * labelRadius;

      g.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .text(h.toString())
        .attr('font-size', isMajor ? '16px' : '12px')
        .attr('font-weight', isMajor ? 'bold' : 'normal')
        .attr('fill', '#64748b')
        .style('pointer-events', 'none');
    }

    // --- DRAW ACTIVITIES ---

    // Sort activities by start time
    const sortedActivities = [...activities].sort((a, b) => {
      return toMinutes(a.startHour, a.startMinute) - toMinutes(b.startHour, b.startMinute);
    });

    const mappedData = sortedActivities.map(act => {
      let start = toMinutes(act.startHour, act.startMinute);
      let end = toMinutes(act.endHour, act.endMinute);

      // Handle wrapping logic:
      // If end < start (e.g. 22:00 -> 07:00), we don't split.
      // We rely on the arc generator handling angle wrapping or manually adjust end angle > start angle

      return { ...act, start, end, isWrap: end < start };
    });

    const arcs = g.selectAll('.activity-arc')
      .data(mappedData)
      .enter()
      .append('g')
      .attr('class', 'activity-arc cursor-pointer hover:opacity-90 transition-opacity')
      .on('click', (event, d) => {
        event.stopPropagation();
        onActivityClick(d as unknown as Activity);
      });

    // Path (draw all paths first)
    arcs.append('path')
      .attr('d', (d) => {
        let sAngle = angleScale(d.start);
        let eAngle = angleScale(d.end);

        if (d.isWrap) {
          eAngle += 2 * Math.PI;
        }

        return arcGenerator({
          startAngle: sAngle,
          endAngle: eAngle,
          innerRadius: innerRadius,
          outerRadius: radius
        } as any);
      })
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Create a separate group for all labels/icons (drawn after all paths)
    const labelGroup = g.append('g').attr('class', 'labels-layer');

    // Labels/Icons in the middle of the arc (draw all icons on top)
    mappedData.forEach((d) => {
      let sAngle = angleScale(d.start);
      let eAngle = angleScale(d.end);
      if (d.isWrap) {
        eAngle += 2 * Math.PI;
      }

      // Calculate centroid manually for wrapped arcs
      const midAngle = (sAngle + eAngle) / 2;
      const midRadius = (innerRadius + radius) / 2;
      const centroid = [Math.sin(midAngle) * midRadius, -Math.cos(midAngle) * midRadius];

      // Always show icons regardless of duration
      const textGroup = labelGroup.append('g')
        .attr('class', 'activity-label')
        .style('pointer-events', 'none');

      // Icon
      textGroup.append('text')
        .attr('transform', `translate(${centroid[0]}, ${centroid[1] - 8})`)
        .attr('text-anchor', 'middle')
        .text(d.icon)
        .attr('font-size', '24px');

      // Title (truncated)
      textGroup.append('text')
        .attr('transform', `translate(${centroid[0]}, ${centroid[1] + 12})`)
        .attr('text-anchor', 'middle')
        .text(d.title.length > 5 ? d.title.substring(0, 4) + '..' : d.title)
        .attr('font-size', '10px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .style('text-shadow', '0px 1px 2px rgba(0,0,0,0.3)');
    });

    // --- CURRENT TIME INDICATOR (CLOCK HAND) ---
    const drawCurrentTimeHand = () => {
      // Remove existing hand
      g.selectAll('.current-time-hand').remove();

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentAngle = angleScale(currentMinutes);

      // Draw a line from center to edge
      g.append('line')
        .attr('class', 'current-time-hand')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', Math.sin(currentAngle) * (radius - 5))
        .attr('y2', -Math.cos(currentAngle) * (radius - 5))
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .style('pointer-events', 'none');

      // Add a small circle at center
      g.append('circle')
        .attr('class', 'current-time-hand')
        .attr('r', 6)
        .attr('fill', '#ef4444')
        .style('pointer-events', 'none');
    };

    drawCurrentTimeHand();

    // Update hand every minute
    const handInterval = setInterval(drawCurrentTimeHand, 60000);

    // --- INTERACTION LAYER ---
    // Invisible overlay to catch clicks on empty spaces
    const overlayArc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    // We add a listener to the whole SVG to catch clicks
    svg.on('click', (event) => {
      // Calculate click coordinates relative to center
      const [x, y] = d3.pointer(event, g.node());
      const distance = Math.sqrt(x * x + y * y);

      // If clicked outside the main circle area, ignore
      if (distance > radius) return;

      // Calculate angle. Math.atan2(y, x). 
      // 0 is usually East (3 o'clock). D3 arc 0 is North (12 o'clock).
      // Let's normalize everything to minutes.

      // Correcting coordinate system rotation
      // Atan2 returns -PI to PI.
      // We want 0 at top (0, -y), PI/2 at right (x, 0).
      // Actually, let's just use standard math and offset.
      // x = r sin(theta), y = -r cos(theta)

      let angle = Math.atan2(x, -y); // (x, -y) aligns 0 with North, increasing clockwise
      if (angle < 0) angle += 2 * Math.PI; // Normalize to 0-2PI

      const totalMinutes = (angle / (2 * Math.PI)) * 1440;
      const { h, m } = fromMinutes(totalMinutes);

      // Round to nearest 15 mins for better UX
      const roundedM = Math.round(m / 15) * 15;
      let finalM = roundedM;
      let finalH = h;
      if (finalM === 60) {
        finalM = 0;
        finalH = (h + 1) % 24;
      }

      onTimeClick(finalH, finalM);
    });

    // Cleanup on unmount
    return () => clearInterval(handInterval);

  }, [activities, width, height, innerRadius, radius, onActivityClick, onTimeClick]);

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center py-4">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="select-none touch-manipulation drop-shadow-xl"
        style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }}
      />
    </div>
  );
};
