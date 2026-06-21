import React from 'react';

import { Scroll, User } from 'lucide-react';

import ContentDisplay from '@/components/templates/new-templates/content-display';
import { Button } from '@/components/ui';

const AboutMe = () => {
  return (
    <ContentDisplay
      className="col-span-2 w-full min-[560px]:col-span-4"
      symbol={<User />}
      name="About Me"
      description="Introduction"
      button={
        <Button size="sm" href="/resume" rightIcon={<Scroll />}>
          Resume
        </Button>
      }
    >
      <div className="text-gray-11 px-4 py-4 text-sm">
        <p className="overflow-auto">
          Software engineer at American Express, building full-stack Banking features on the Internal
          Servicing Platform. I specialize in end-to-end feature delivery, platform modernization,
          and AI-powered developer tooling. Previously at Deloitte and Propulsion Technologies
          International.
        </p>
      </div>
    </ContentDisplay>
  );
};

export default AboutMe;
