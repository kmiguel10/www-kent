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
      name="Experiences"
      description=""
    >
      <>
        <Accordion
          type="single"
          collapsible
          className="grid w-full grid-flow-row auto-rows-max flex-col overflow-hidden rounded-none border border-gray-6 bg-gray-2"
        >
          <AccordionItem value="item-2" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">Full Stack Developer - Projects</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  July 2022 - Present
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">
                  July 2022 - Present
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-3">
              {/* <p className="text-md font-semibold">
                Smart Contract Auditor - Code4Arena , Shelock DeFi
              </p> */}
              <div className="py-4">
                <h1 className="py-2">Owemee - Expense Splitting App</h1>

                <ul className="list-disc px-4">
                  <li>
                    Developed a cross-platform expense-splitting app using React Native Expo with
                    Tamagui for UI and Supabase for backend, enabling real-time updates and seamless
                    user experience
                  </li>
                  <li>
                    Implemented secure user authentication, efficient transaction tracking, and
                    real-time synchronization; leveraged ChatGPT and Claude for development
                    assistance and successfully submitted to the App Store
                  </li>
                </ul>
              </div>
              <div className="py-4">
                <h1 className="py-2">Ranked Choice Voting System</h1>
                <ul className="list-disc px-4">
                  <li>
                    Engineered a Solidity-based smart contract incorporating Chainlink Automation
                    for time-triggered election phase transitions, enhancing efficiency and
                    transparency
                  </li>
                  <li>
                    Leveraged Remix IDE and Hardhat framework for comprehensive development,
                    including writing and executing unit tests and election process simulation
                    scripts
                  </li>
                  {/* <li>
                  Utilized tools like foundry, hardhat, slither, etc. in order to write invariant
                  tests and conduct manual code reviews on smart contracts
                </li> */}
                </ul>
              </div>
              <div className="py-4">
                <h1 className="py-2">Ethereum Marketplace</h1>
                <ul className="list-disc px-4">
                  <li>
                    Designed and implemented a Solidity smart contract enabling secure,
                    Ethereum-based course purchases with seamless Metamask integration for
                    transactions
                  </li>
                  <li>
                    Crafted a responsive front-end using Next.js and Tailwind CSS, integrating
                    web3.js for blockchain interaction, and utilized Truffle, Ganache, and Mocha for
                    robust testing and development
                  </li>
                  {/* <li>
                  Utilized tools like foundry, hardhat, slither, etc. in order to write invariant
                  tests and conduct manual code reviews on smart contracts
                </li> */}
                </ul>
              </div>
              <div className="py-4">
                <h1 className="py-2">Decentralized Lottery</h1>
                <ul className="list-disc px-4">
                  <li>
                    Developed a hybrid smart contract leveraging Chainlink VRF (Verifiable Random
                    Function) for provably fair winner selection and Chainlink Keepers for automated
                    lottery execution
                  </li>
                  <li>
                    Created an intuitive user interface with Next.js and Tailwind CSS, integrating
                    web3.js for seamless blockchain interaction and smart contract calls
                  </li>
                  {/* <li>
                  Utilized tools like foundry, hardhat, slither, etc. in order to write invariant
                  tests and conduct manual code reviews on smart contracts
                </li> */}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-1" className="text-md">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="text-left font-medium">Blockchain Security Engineer</div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  July 2022 - Present
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">
                  July 2022 - Present
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-3">
              {/* <p className="text-md font-semibold">
                Smart Contract Auditor - Code4Arena , Shelock DeFi
              </p> */}
              <ul className="list-disc px-4">
                <li>
                  Performed security reviews in order to find vulnerabilities in protocols
                  participating in code4arena, sherlockdefi, and codehawks
                </li>
                <li>
                  Utilized tools like foundry, hardhat, slither, etc. in order to write invariant
                  tests and conduct manual code reviews on smart contracts
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="flex items-baseline">
                  <div className="pr-4 text-left font-medium">Full Stack Developer</div>
                  <span className="md:text-small mt-0.5 text-left text-sm text-gray-11 md:mt-1">
                    Deloitte
                  </span>
                </div>

                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  November 2020 - July 2022
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">
                  November 2020 - July 2022
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-3 text-left">
              <ul className="list-disc px-4">
                <li>
                  Developed single page applications using Vue.js with Typescript from a .NET based
                  legacy web application which is utilized by 1000s of users filing for worker’s
                  compensation in the state of Pennyslvania
                </li>
                <li>
                  Built RESTful Web API’s using ASP.NET used to serve data between a Vue.js
                  front-end and SQL back-end which gives clients access to the application from any
                  browsers and mobile devices
                </li>
                <li>
                  Served as the main developer tasked in triaging, investigating and resolving bugs
                  from 5 sprint cycles across 50 applications while utilizing debugging tools like
                  Chrome Developer tools and Vue.js Dev Tools
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger className="flex w-full">
              <div className="flex w-full items-center p-3 md:flex-row md:justify-between">
                <div className="flex items-baseline">
                  <div className="pr-4 text-left font-medium">Digital Technology Analyst</div>
                  <span className="md:text-small mt-0.5 text-left text-sm text-gray-11 md:mt-1">
                    Propulsion Technologies Internation
                  </span>
                </div>
                <span className="md:text-small mt-0.5 hidden pr-3 text-sm text-gray-11 md:mt-1 md:block">
                  July 2018 - June 2020
                </span>
              </div>
              <div className="space-x-2 md:hidden">
                <span className="md:text-small mt-0.5 text-sm text-gray-11 md:mt-1">
                  July 2018 - June 2020
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-3 text-left">
              <ul className="list-disc px-4">
                <li>
                  Led the company’s digital transformation by innovating digital factory concepts
                  including machine connectivity, data visualization, data analysis, and removing
                  data silos which reduced the time for managers and engineers to access and analyze
                  data from 2 hours to 5 minutes using Power BI
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>
    </ContentDisplay>
  );
};

export default Experience;
