import React from 'react';

import { Briefcase } from 'lucide-react';

import ContentDisplay from '@/components/templates/new-templates/content-display';

const Skills = () => {
  return (
    <ContentDisplay
      className="col-span-2 w-full min-[560px]:col-span-4"
      symbol={<Briefcase />}
      name="American Express"
      description="Software Engineer · Banking & Servicing Platform · 2024–Present"
    >
      <div className="space-y-6 px-4 py-4 text-sm text-gray-11">
        <p className="leading-relaxed">
          Full-stack engineer on the Internal Servicing Platform (ISP) at American Express, focused on
          Banking modernization. Delivered 8+ customer-facing features end-to-end — from requirements
          through production — while owning cross-team coordination, observability, and AI tooling that
          accelerated engineering productivity across the org.
        </p>

<div>
          <h3 className="mb-2 font-medium text-gray-12">Areas of Work</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Banking Features',
              'Platform Modernization',
              'AI / Developer Tooling',
              'Observability',
              'Engineering Leadership',
              'Mentorship',
            ].map((area) => (
              <span
                key={area}
                className="rounded border border-gray-6 bg-gray-3 px-2 py-0.5 text-xs text-gray-11"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ContentDisplay>
  );
};

export default Skills;
