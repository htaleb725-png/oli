import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  category: 'core' | 'district' | 'service' | 'satellite';
  val: number;
  color: string;
  glowColor: string;
  icon?: string;
  desc?: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  value: number;
}

const INITIAL_NODES: D3Node[] = [
  { id: 'parliament', name: 'مجلس النواب العراقي', category: 'core', val: 28, color: '#f59e0b', glowColor: '#fbbf24', desc: 'المقر النيابي والتشريعي' },
  { id: 'alnashi_main', name: 'مكتب النائب علا الناشي', category: 'core', val: 24, color: '#eab308', glowColor: '#facc15', desc: 'المقر الرئيسي - ذي قار' },
  { id: 'nasiriyah', name: 'قضاء الناصرية المركز', category: 'district', val: 18, color: '#0ea5e9', glowColor: '#38bdf8', desc: 'دائرة استعلامات المركز' },
  { id: 'shatra', name: 'قضاء الشطرة', category: 'district', val: 16, color: '#06b6d4', glowColor: '#22d3ee', desc: 'شعبة التنسيق والمتابعة' },
  { id: 'rifai', name: 'قضاء الرفاعي', category: 'district', val: 15, color: '#10b981', glowColor: '#34d399', desc: 'مكتب شمال ذي قار' },
  { id: 'suq', name: 'قضاء سوق الشيوخ', category: 'district', val: 16, color: '#8b5cf6', glowColor: '#a78bfa', desc: 'مكتب جنوب ذي قار' },
  { id: 'chibayish', name: 'قضاء الجبايش والأهوار', category: 'district', val: 15, color: '#14b8a6', glowColor: '#2dd4bf', desc: 'ممثلية مناطق الأهوار' },
  { id: 'social_care', name: 'قسم الرعاية الاجتماعية', category: 'service', val: 17, color: '#f97316', glowColor: '#fb923c', desc: 'إدارة الشمول والمعونات' },
  { id: 'reception', name: 'الاستعلامات وخدمة المواطنين', category: 'service', val: 19, color: '#3b82f6', glowColor: '#60a5fa', desc: 'استقبال المراجعين وتوثيق الطلبات' },
  { id: 'health', name: 'العلاج والحالات الصحية', category: 'service', val: 14, color: '#ec4899', glowColor: '#f472b6', desc: 'العمليات والتنسيق الطبي' },
  { id: 'tribal', name: 'شؤون العشائر والوجهاء', category: 'service', val: 16, color: '#d97706', glowColor: '#f59e0b', desc: 'التنسيق المجتمعي والعشائري' },
  { id: 'archive', name: 'الأرشيف والسكنر الذكي', category: 'satellite', val: 13, color: '#6366f1', glowColor: '#818cf8', desc: 'أرشفة الوثائق والصور' },
  { id: 'cloud_sync', name: 'السحابة وقاعدة البيانات', category: 'satellite', val: 15, color: '#22c55e', glowColor: '#4ade80', desc: 'المزامنة الحية المشفرة' },
  { id: 'director', name: 'الإدارة والمتابعة التنفيذية', category: 'core', val: 18, color: '#e11d48', glowColor: '#fb7185', desc: 'التوجيه والإحالات الرسمية' }
];

const INITIAL_LINKS: D3Link[] = [
  { source: 'parliament', target: 'alnashi_main', value: 3 },
  { source: 'alnashi_main', target: 'director', value: 3 },
  { source: 'alnashi_main', target: 'reception', value: 2.5 },
  { source: 'alnashi_main', target: 'nasiriyah', value: 2 },
  { source: 'alnashi_main', target: 'shatra', value: 2 },
  { source: 'alnashi_main', target: 'rifai', value: 2 },
  { source: 'alnashi_main', target: 'suq', value: 2 },
  { source: 'alnashi_main', target: 'chibayish', value: 2 },
  { source: 'alnashi_main', target: 'cloud_sync', value: 2.5 },
  { source: 'reception', target: 'social_care', value: 2 },
  { source: 'reception', target: 'health', value: 1.5 },
  { source: 'reception', target: 'tribal', value: 1.5 },
  { source: 'reception', target: 'archive', value: 2 },
  { source: 'director', target: 'archive', value: 1.5 },
  { source: 'nasiriyah', target: 'shatra', value: 1 },
  { source: 'shatra', target: 'rifai', value: 1 },
  { source: 'nasiriyah', target: 'suq', value: 1 },
  { source: 'suq', target: 'chibayish', value: 1 },
  { source: 'social_care', target: 'cloud_sync', value: 1.8 }
];

export const D3InteractiveNetwork: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);
  const [activePreset, setActivePreset] = useState<'network' | 'districts' | 'services'>('network');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous SVG
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'w-full h-full select-none cursor-grab active:cursor-grabbing');

    // Defs for gradients, glows, and filters
    const defs = svg.append('defs');

    // Radial background gradient
    const bgRadial = defs.append('radialGradient')
      .attr('id', 'd3-bg-aura')
      .attr('cx', '50%')
      .attr('cy', '45%')
      .attr('r', '60%');
    bgRadial.append('stop').attr('offset', '0%').attr('stop-color', '#1e293b').attr('stop-opacity', '0.45');
    bgRadial.append('stop').attr('offset', '50%').attr('stop-color', '#0f172a').attr('stop-opacity', '0.25');
    bgRadial.append('stop').attr('offset', '100%').attr('stop-color', '#020617').attr('stop-opacity', '0');

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'd3-node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4.5')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Create background aura
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#d3-bg-aura)')
      .attr('pointer-events', 'none');

    // Create container group with zoom/pan support
    const g = svg.append('g').attr('class', 'main-network-group');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Deep copy data for D3 mutation
    const nodes: D3Node[] = JSON.parse(JSON.stringify(INITIAL_NODES));
    const links: D3Link[] = JSON.parse(JSON.stringify(INITIAL_LINKS));

    // D3 Force Simulation
    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links).id(d => d.id).distance(d => (d.value ? 160 / d.value : 100)))
      .force('charge', d3.forceManyBody().strength(-380).distanceMax(450))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.85))
      .force('collision', d3.forceCollide().radius(d => (d as D3Node).val * 1.7))
      .force('radial', d3.forceRadial(Math.min(width, height) * 0.28, width / 2, height / 2).strength(0.12));

    // Links Rendering
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', d => Math.max(1.2, d.value * 1.3))
      .attr('stroke-dasharray', d => d.value > 2 ? 'none' : '4, 4');

    // Pulse circles on links (flowing data packets)
    const packetGroup = g.append('g').attr('class', 'data-packets');
    const packets = packetGroup.selectAll('circle')
      .data(links)
      .enter()
      .append('circle')
      .attr('r', 2.5)
      .attr('fill', '#f59e0b')
      .attr('opacity', 0.75)
      .attr('filter', 'url(#d3-node-glow)');

    let progress = 0;
    d3.timer(() => {
      progress = (progress + 0.006) % 1;
      packets.each(function(d: any) {
        if (d.source.x !== undefined && d.target.x !== undefined) {
          const x = d.source.x + (d.target.x - d.source.x) * progress;
          const y = d.source.y + (d.target.y - d.source.y) * progress;
          d3.select(this).attr('cx', x).attr('cy', y);
        }
      });
    });

    // Nodes Rendering
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-item cursor-pointer')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node outer ripple halo
    node.append('circle')
      .attr('r', d => d.val * 1.5)
      .attr('fill', d => d.color)
      .attr('opacity', 0.12)
      .attr('class', 'animate-pulse');

    // Node glowing body
    node.append('circle')
      .attr('r', d => d.val)
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => d.category === 'core' ? 2.5 : 1.5)
      .attr('stroke-opacity', 0.8)
      .attr('filter', 'url(#d3-node-glow)')
      .on('mouseenter', (_event, d) => {
        setHoveredNode(d);
        d3.select(_event.currentTarget as SVGCircleElement)
          .transition()
          .duration(200)
          .attr('r', d.val * 1.35)
          .attr('stroke-width', 3.5);
      })
      .on('mouseleave', (_event, d) => {
        setHoveredNode(null);
        d3.select(_event.currentTarget as SVGCircleElement)
          .transition()
          .duration(200)
          .attr('r', d.val)
          .attr('stroke-width', d.category === 'core' ? 2.5 : 1.5);
      });

    // Node Center Dot
    node.append('circle')
      .attr('r', d => Math.max(3, d.val * 0.28))
      .attr('fill', '#ffffff')
      .attr('pointer-events', 'none');

    // Node Arabic Label
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.val + 16)
      .attr('fill', '#e2e8f0')
      .attr('font-size', d => d.category === 'core' ? '12px' : '10px')
      .attr('font-weight', d => d.category === 'core' ? '900' : '600')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 2px 6px rgba(0,0,0,0.9)');

    // Tick Handler
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x || 0)
        .attr('y1', d => (d.source as D3Node).y || 0)
        .attr('x2', d => (d.target as D3Node).x || 0)
        .attr('y2', d => (d.target as D3Node).y || 0);

      node.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      svg.attr('viewBox', `0 0 ${w} ${h}`);
      simulation.force('center', d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      simulation.stop();
      window.removeEventListener('resize', handleResize);
    };
  }, [activePreset]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-auto select-none" dir="rtl">
      {/* Visual Canvas Target */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Info Badge for Hovered Node */}
      {hoveredNode && (
        <div className="absolute bottom-16 right-8 max-w-sm p-4 rounded-2xl bg-slate-900/95 border border-amber-500/40 shadow-2xl backdrop-blur-md text-white animate-in fade-in slide-in-from-bottom-2 z-20 pointer-events-none">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
            <h4 className="text-sm font-black text-amber-300">{hoveredNode.name}</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{hoveredNode.desc}</p>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
            <span>عقدة تفاعلية D3</span>
            <span className="text-amber-400 font-mono">اسحب بالماوس لتحريك العقد</span>
          </div>
        </div>
      )}

      {/* Floating HUD Controls */}
      <div className="absolute top-20 right-6 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/60 shadow-lg text-[11px] text-slate-300">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="font-bold text-amber-400">شبكة D3 التفاعلية الحية</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400 text-[10px]">تكبير / تصغير / سحب</span>
      </div>
    </div>
  );
};
