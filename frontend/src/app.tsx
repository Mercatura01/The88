import React, { useState } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import WalletSection from './components/WalletSection';
import ProjectMarketplace from './components/ProjectMarketplace';
import NetworkingHub from './components/NetworkingHub';
import UserProfilePage from './components/UserProfilePage';
import ValidatorDashboard from './components/ValidatorDashboard';
import LoginButton from './components/LoginButton';
import SimulationBanner from './components/SimulationBanner';

function App() {
  const { identity } = useInternetIdentity();
  const [activeSection, setActiveSection] = useState<'home' | 'projects' | 'network' | 'profile' | 'validator'>('home');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const isAuthenticated = !!identity;

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setActiveSection('profile');
  };

  const handleBackFromProfile = () => {
    setSelectedUserId(null);
    setActiveSection('network');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      {/* Simulation Banner */}
      <SimulationBanner />

      {/* Navigation */}
      <nav className="fixed top-16 left-0 right-0 z-50 bg-blue-900/80 backdrop-blur-lg border-b border-blue-700/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-silver">
                The88
              </h1>
            </div>
            
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <button
                  onClick={() => setActiveSection('home')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'home'
                      ? 'bg-blue-700 text-white'
                      : 'text-gray-300 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => setActiveSection('projects')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'projects'
                      ? 'bg-blue-700 text-white'
                      : 'text-gray-300 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => setActiveSection('network')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === 'network'
                      ? 'bg-blue-700 text-white'
                      : 'text-gray-300 hover:bg-blue-800 hover:text-white'
                  }`}
                >
                  Network
                </button>
                {isAuthenticated && (
                  <button
                    onClick={() => setActiveSection('validator')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeSection === 'validator'
                        ? 'bg-blue-700 text-white'
                        : 'text-gray-300 hover:bg-blue-800 hover:text-white'
                    }`}
                  >
                    Validator
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <LoginButton />
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-blue-900/90">
            <button
              onClick={() => setActiveSection('home')}
              className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                activeSection === 'home'
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-300 hover:bg-blue-800 hover:text-white'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveSection('projects')}
              className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                activeSection === 'projects'
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-300 hover:bg-blue-800 hover:text-white'
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setActiveSection('network')}
              className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                activeSection === 'network'
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-300 hover:bg-blue-800 hover:text-white'
              }`}
            >
              Network
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setActiveSection('validator')}
                className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-colors ${
                  activeSection === 'validator'
                    ? 'bg-blue-700 text-white'
                    : 'text-gray-300 hover:bg-blue-800 hover:text-white'
                }`}
              >
                Validator
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-32">
        {activeSection === 'home' && (
          <>
            <Hero />
            <HowItWorks />
            {isAuthenticated && <WalletSection />}
          </>
        )}
        
        {activeSection === 'projects' && (
          <ProjectMarketplace onViewProfile={handleViewProfile} />
        )}
        
        {activeSection === 'network' && (
          <NetworkingHub onViewProfile={handleViewProfile} />
        )}

        {activeSection === 'validator' && (
          <ValidatorDashboard />
        )}

        {activeSection === 'profile' && selectedUserId && (
          <UserProfilePage 
            userId={selectedUserId} 
            onBack={handleBackFromProfile}
          />
        )}
      </div>
      
      {/* Footer */}
      <footer className="mt-16 py-8 text-center text-gray-400 border-t border-blue-700/30">
        <p className="text-sm">
          © 2025. Built with{' '}
          <span className="text-red-400 animate-pulse">♥</span>{' '}
          using{' '}
          <a 
            href="https://caffeine.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
