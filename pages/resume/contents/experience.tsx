import React from 'react';

import { KanbanSquare } from 'lucide-react';

import ContentDisplay from '@/components/templates/new-templates/content-display';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const Experience = () => {
  return (
    <ContentDisplay
      className="col-span-2 w-full min-[560px]:col-span-4"
      symbol={<KanbanSquare />}
      name="Experience"
      description="American Express · ISP Banking Platform"
    >
      <>
        <Accordion
          type="single"
          collapsible
          className="grid w-full grid-flow-row auto-rows-max flex-col overflow-hidden rounded-none border border-gray-6 bg-gray-2"
        >
          {/* Group 1: Banking Feature Delivery */}
          <AccordionItem value="banking-delivery" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">Banking Feature Delivery</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  2025–2026
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">2025–2026</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-5 p-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-10">
                  2025
                </p>
                <div className="space-y-4 text-gray-11">
                  <div>
                    <h4 className="font-semibold text-gray-12">
                      Logging & Observability (ISP Logger + ELF)
                    </h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Architected and delivered a unified observability framework across multiple
                        Banking journeys, partnering with SRE to improve log quality and reduce
                        diagnostic time
                      </li>
                      <li>
                        Built analytics dashboards tracking load times, journey completion rates, and
                        feature usage; drove adoption through two major releases (MVP1 & MVP2)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-12">Account Restrictions Management</h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Built the Account Restrictions module from scratch — designed, integrated four
                        REST APIs, and shipped to production with a 100% test pass rate and zero
                        post-release defects
                      </li>
                      <li>
                        Enabled fraud, compliance, and operations teams to manage restrictions directly
                        in the servicing platform, reducing manual escalations
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-12">
                      Customer Details – Service Alerts & Nordics Expansion
                    </h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Migrated Service Alerts from a legacy architecture to a modern, scalable
                        platform, introducing new backend services and APIs
                      </li>
                      <li>
                        Led Nordics market expansion with localized UX for Email and Phone servicing,
                        improving agent efficiency and reducing average call handling time
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-10">
                  2026
                </p>
                <div className="space-y-4 text-gray-11">
                  <div>
                    <h4 className="font-semibold text-gray-12">Business Savings Account (BSA)</h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Led ~42% of the total initiative scope (10 of 24 workstreams) to onboard a new
                        line of business onto the Banking platform — covering transactions, holds,
                        restrictions, limits, and rewards tracking
                      </li>
                      <li>
                        Coordinated across 4 engineering teams; established reusable onboarding patterns
                        that reduce future ramp-up time
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-12">Seamless Switch</h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Delivered product-switching and caller-switching capabilities across 4 Banking
                        journeys, including eligibility validation, account token migration, and journey
                        refresh logic
                      </li>
                      <li>
                        Standardized behavior across unsupported product scenarios, improving consistency
                        platform-wide
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-12">Bank Holds & Platform Migration</h4>
                    <ul className="mt-1 list-disc space-y-1 px-4">
                      <li>
                        Designed and shipped Bank Holds as a net-new Banking journey, owning the full
                        delivery lifecycle from implementation through deployment
                      </li>
                      <li>
                        Contributed to a platform-wide architecture migration across 4 journeys,
                        improving compatibility with the evolving centralized platform
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Group 2: AI Tooling & Innovation */}
          <AccordionItem value="ai-tooling" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">AI Tooling & Innovation</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  2025–2026
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">2025–2026</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 p-3 text-gray-11">
              <div>
                <h4 className="font-semibold text-gray-12">PKL Agents – AI Enablement Platform</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    Founded and maintain a centralized AI development platform for the engineering org,
                    built on GitHub Copilot Skills
                  </li>
                  <li>
                    Authored reusable coding agents covering logging integration, API patterns, data
                    fetching, and context architecture — reducing onboarding time and improving
                    consistency across teams
                  </li>
                  <li>Defined contribution standards and governance to scale adoption sustainably</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-12">Innovation Projects</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    <span className="font-medium text-gray-12">Function Finder</span> — internal
                    tooling to improve code discoverability and developer efficiency
                  </li>
                  <li>
                    <span className="font-medium text-gray-12">AuthCompare</span> — built a
                    diagnostic tool for authentication analysis and troubleshooting
                  </li>
                  <li>
                    <span className="font-medium text-gray-12">One Stop Solution</span> — platform
                    utility that simplifies common engineering workflows and integrations
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Group 3: Platform Health */}
          <AccordionItem value="platform-health" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">Platform Health & Engineering Standards</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  2025–2026
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">2025–2026</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 p-3 text-gray-11">
              <div>
                <h4 className="font-semibold text-gray-12">Platform Metrics Governance</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    Owned platform health governance across two Banking services — ran recurring reviews
                    covering security, reliability, maintainability, vulnerability scores, and code
                    complexity
                  </li>
                  <li>
                    Sustained A-grade platform health targets and drove remediation planning for
                    identified risks
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-12">Engineering Excellence Champion</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    Established recurring Design Review sessions that improved architecture quality and
                    decision-making consistency across the team
                  </li>
                  <li>
                    Elevated documentation standards and contributed to the internal Developer Center
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Group 4: Leadership & Mentorship */}
          <AccordionItem value="leadership-mentorship" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">Leadership & Mentorship</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  2025–2026
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">2025–2026</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 p-3 text-gray-11">
              <div>
                <h4 className="font-semibold text-gray-12">Engagement & Innovation Programs</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    Led the 5+ Learning Hub and created the 5+ Showcasing Program — a recurring forum
                    for engineers to present AI and technical learnings, increasing knowledge-sharing
                    across the org
                  </li>
                  <li>
                    Organized the Innovation Ideas Showcase and facilitated ElevateX events, driving
                    cross-team collaboration and idea generation
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-12">Mentorship</h4>
                <ul className="mt-1 list-disc space-y-1 px-4">
                  <li>
                    Mentored a junior engineer through weekly coaching sessions on architecture,
                    delivery, and best practices — enabling independent feature ownership within
                    months
                  </li>
                  <li>
                    Deliberately involved two early-career engineers in AI tooling and platform
                    initiatives to accelerate their technical growth
                  </li>
                  <li>
                    Volunteered at a youth tech camp, leading hands-on sessions on Smart Devices and
                    IoT
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>
    </ContentDisplay>
  );
};

export default Experience;
