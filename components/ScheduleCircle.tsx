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
  const radius = Math.min(width, height) / 2 - 40; // Padding for labels
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

    // Arc generator
    const arcGenerator = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .startAngle(d => angleScale(d.start))
      .endAngle(d => angleScale(d.end))
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
      
      // Handle wrapping logic simply for visualization:
      // If end < start, it means it crosses midnight. 
      // We will render it as two parts or just the part that fits on current day for simplicity 
      // if we assume linear 0-24. 
      // Better approach for circular: split if wrapped.
      
      const segments = [];
      if (end < start) {
        segments.push({ ...act, start, end: 1440, isWrap: true }); // Until midnight
        segments.push({ ...act, start: 0, end: end, isWrap: true }); // From midnight
      } else {
        segments.push({ ...act, start, end, isWrap: false });
      }
      return segments;
    }).flat();

    const arcs = g.selectAll('.activity-arc')
      .data(mappedData)
      .enter()
      .append('g')
      .attr('class', 'activity-arc cursor-pointer hover:opacity-90 transition-opacity')
      .on('click', (event, d) => {
        event.stopPropagation();
        onActivityClick(d as unknown as Activity);
      });

    // Path
    arcs.append('path')
      .attr('d', arcGenerator as any)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Labels/Icons in the middle of the arc
    arcs.each(function(d) {
      const centroid = arcGenerator.centroid(d as any);
      const angleDiff = d.end - d.start;
      // Only show if the slice is big enough (at least 30 mins)
      if (angleDiff > 30) {
        const group = d3.select(this);
        
        // Icon
        group.append('text')
          .attr('transform', `translate(${centroid[0]}, ${centroid[1] - 8})`)
          .attr('text-anchor', 'middle')
          .text(d.icon)
          .attr('font-size', '24px')
          .style('pointer-events', 'none');

        // Title (truncated)
        group.append('text')
          .attr('transform', `translate(${centroid[0]}, ${centroid[1] + 12})`)
          .attr('text-anchor', 'middle')
          .text(d.title.length > 5 ? d.title.substring(0, 4) + '..' : d.title)
          .attr('font-size', '10px')
          .attr('fill', '#fff')
          .attr('font-weight', 'bold')
          .style('text-shadow', '0px 1px 2px rgba(0,0,0,0.3)')
          .style('pointer-events', 'none');
      }
    });

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
        const distance = Math.sqrt(x*x + y*y);

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

  }, [activities, width, height, innerRadius, radius, onActivityClick, onTimeClick]);

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center py-4">
      <svg 
        ref={svgRef} 
        width={width} 
        height={height} 
        className="select-none touch-manipulation drop-shadow-xl"
        style={{ maxWidth: '100%', height: 'auto' }} 
      />
    </div>
  );
};
