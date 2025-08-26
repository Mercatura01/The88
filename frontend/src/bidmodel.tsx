import React, { useState } from 'react';
import { useSubmitBid, MilestonePaymentMath } from '../hooks/useQueries';

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: bigint | null;
}

interface MilestoneProposal {
  title: string;
  description: string;
  paymentAmount: string; // String for input handling
  deliverableRequirements: string;
  estimatedDuration: string;
}

const BidModal: React.FC<BidModalProps> = ({ isOpen, onClose, projectId }) => {
  const [formData, setFormData] = useState({
    proposedRate: '',
    timeline: '',
    coverLetter: '',
    portfolioLinks: ['']
  });
  const [hasMilestoneProposal, setHasMilestoneProposal] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneProposal[]>([
    {
      title: '',
      description: '',
      paymentAmount: '',
      deliverableRequirements: '',
      estimatedDuration: ''
    }
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitBidMutation = useSubmitBid();

  const calculateMilestoneTotal = () => {
    return milestones.reduce((sum, milestone) => {
      const amount = parseFloat(milestone.paymentAmount) || 0;
      return sum + amount;
    }, 0);
  };

  const calculateMilestonePercentage = (amount: string) => {
    const proposedRate = parseFloat(formData.proposedRate) || 0;
    const milestoneAmount = parseFloat(amount) || 0;
    if (proposedRate === 0) return 0;
    return (milestoneAmount / proposedRate) * 100;
  };

  const validateMilestones = () => {
    if (!hasMilestoneProposal) return { isValid: true, errors: [] };
    
    const errors: string[] = [];
    const proposedRate = parseFloat(formData.proposedRate) || 0;
    const milestoneTotal = calculateMilestoneTotal();
    
    // Enhanced validation with precise math - use cents for accuracy
    const proposedRateCents = MilestonePaymentMath.egpToCents(proposedRate);
    const milestoneTotalCents = MilestonePaymentMath.egpToCents(milestoneTotal);
    const discrepancy = milestoneTotalCents - proposedRateCents;
    
    // Check if milestone total matches proposed rate (within 1 cent tolerance)
    if (discrepancy !== BigInt(0)) {
      const discrepancyEgp = MilestonePaymentMath.centsToEgp(discrepancy > 0 ? discrepancy : -discrepancy);
      errors.push(`Milestone payments (${milestoneTotal.toFixed(2)} EGP) must exactly equal proposed rate (${proposedRate.toFixed(2)} EGP). Discrepancy: ${discrepancyEgp.toFixed(2)} EGP`);
    }
    
    // Check individual milestones
    milestones.forEach((milestone, index) => {
      if (!milestone.title.trim()) {
        errors.push(`Milestone ${index + 1}: Title is required`);
      }
      if (!milestone.description.trim()) {
        errors.push(`Milestone ${index + 1}: Description is required`);
      }
      if (!milestone.deliverableRequirements.trim()) {
        errors.push(`Milestone ${index + 1}: Deliverable requirements are required`);
      }
      if (!milestone.estimatedDuration.trim()) {
        errors.push(`Milestone ${index + 1}: Estimated duration is required`);
      }
      const amount = parseFloat(milestone.paymentAmount) || 0;
      if (amount <= 0) {
        errors.push(`Milestone ${index + 1}: Payment amount must be greater than 0`);
      }
      
      // Validate percentage calculation
      const expectedPercentage = calculateMilestonePercentage(milestone.paymentAmount);
      if (expectedPercentage > 100) {
        errors.push(`Milestone ${index + 1}: Payment amount cannot exceed total bid amount`);
      }
    });
    
    // Validate percentages sum to 100%
    const totalPercentage = milestones.reduce((sum, milestone) => {
      return sum + calculateMilestonePercentage(milestone.paymentAmount);
    }, 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) {
      errors.push(`Milestone percentages must sum to 100%, got ${totalPercentage.toFixed(2)}%`);
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectId) {
      setErrorMessage('Project ID is missing');
      return;
    }

    // Validate basic form data
    if (!formData.proposedRate || parseFloat(formData.proposedRate) <= 0) {
      setErrorMessage('Please enter a valid proposed rate');
      return;
    }

    if (!formData.timeline.trim()) {
      setErrorMessage('Please enter a timeline');
      return;
    }

    if (!formData.coverLetter.trim()) {
      setErrorMessage('Please enter a cover letter');
      return;
    }

    // Enhanced milestone validation
    const milestoneValidation = validateMilestones();
    if (!milestoneValidation.isValid) {
      setErrorMessage(milestoneValidation.errors[0]);
      return;
    }

    setErrorMessage(null);

    try {
      const bidData: any = {
        projectId,
        proposedRate: parseFloat(formData.proposedRate),
        timeline: formData.timeline,
        coverLetter: formData.coverLetter,
        portfolioLinks: formData.portfolioLinks.filter(link => link.trim() !== '')
      };

      // Add milestone proposal with precise calculations
      if (hasMilestoneProposal && milestones.length > 0) {
        const proposedRateCents = MilestonePaymentMath.egpToCents(parseFloat(formData.proposedRate));
        
        bidData.proposedMilestones = milestones.map((milestone, index) => {
          const paymentAmount = parseFloat(milestone.paymentAmount);
          const paymentAmountCents = MilestonePaymentMath.egpToCents(paymentAmount);
          const paymentPercentage = MilestonePaymentMath.calculatePercentage(paymentAmountCents, proposedRateCents);
          
          return {
            title: milestone.title,
            description: milestone.description,
            paymentAmount: paymentAmount,
            paymentPercentage: paymentPercentage,
            deliverableRequirements: milestone.deliverableRequirements,
            estimatedDuration: milestone.estimatedDuration,
            order: index + 1
          };
        });
        
        // Final validation to ensure exact sum
        const totalMilestoneAmount = bidData.proposedMilestones.reduce((sum: number, m: any) => sum + m.paymentAmount, 0);
        if (Math.abs(totalMilestoneAmount - parseFloat(formData.proposedRate)) > 0.01) {
          setErrorMessage('Milestone payment calculation error. Please adjust amounts to match proposed rate exactly.');
          return;
        }
      }

      await submitBidMutation.mutateAsync(bidData);
      
      // Show success message
      setShowSuccess(true);
      
      // Reset form after a delay and close modal
      setTimeout(() => {
        setFormData({
          proposedRate: '',
          timeline: '',
          coverLetter: '',
          portfolioLinks: ['']
        });
        setMilestones([{
          title: '',
          description: '',
          paymentAmount: '',
          deliverableRequirements: '',
          estimatedDuration: ''
        }]);
        setHasMilestoneProposal(false);
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit bid:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit bid. Please try again.');
    }
  };

  const addPortfolioLink = () => {
    setFormData(prev => ({
      ...prev,
      portfolioLinks: [...prev.portfolioLinks, '']
    }));
  };

  const updatePortfolioLink = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.map((link, i) => i === index ? value : link)
    }));
  };

  const removePortfolioLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      portfolioLinks: prev.portfolioLinks.filter((_, i) => i !== index)
    }));
  };

  const addMilestone = () => {
    setMilestones([...milestones, {
      title: '',
      description: '',
      paymentAmount: '',
      deliverableRequirements: '',
      estimatedDuration: ''
    }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const updateMilestone = (index: number, field: keyof MilestoneProposal, value: string) => {
    setMilestones(prev => prev.map((milestone, i) => 
      i === index ? { ...milestone, [field]: value } : milestone
    ));
  };

  // Auto-distribute remaining budget when milestones are added/removed
  const autoDistributeRemainingBudget = () => {
    const proposedRate = parseFloat(formData.proposedRate) || 0;
    if (proposedRate <= 0 || milestones.length === 0) return;
    
    const currentTotal = calculateMilestoneTotal();
    const remaining = proposedRate - currentTotal;
    
    if (Math.abs(remaining) > 0.01) {
      // Distribute remaining amount to the last milestone
      const updatedMilestones = [...milestones];
      const lastIndex = updatedMilestones.length - 1;
      const lastMilestoneAmount = parseFloat(updatedMilestones[lastIndex].paymentAmount) || 0;
      updatedMilestones[lastIndex] = {
        ...updatedMilestones[lastIndex],
        paymentAmount: (lastMilestoneAmount + remaining).toFixed(2)
      };
      setMilestones(updatedMilestones);
    }
  };

  const handleClose = () => {
    if (!submitBidMutation.isPending) {
      setErrorMessage(null);
      setShowSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const milestoneTotal = calculateMilestoneTotal();
  const proposedRate = parseFloat(formData.proposedRate) || 0;
  const milestoneValidation = validateMilestones();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose}></div>
      
      <div className="relative bg-gradient-to-br from-blue-900/95 to-blue-800/95 backdrop-blur-lg rounded-2xl p-6 w-full max-w-4xl border border-blue-700/30 shadow-2xl max-h-[90vh] overflow-y-auto">
        {showSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <span className="text-white text-2xl">✓</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Bid Submitted Successfully!</h3>
            <p className="text-gray-300">Your bid has been submitted and the project owner will be notified.</p>
            {hasMilestoneProposal && (
              <div className="mt-4 p-3 bg-blue-800/30 rounded-lg">
                <p className="text-blue-300 text-sm">
                  ✨ Your milestone proposal with precise payment calculations has been included
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Submit Your Bid</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={submitBidMutation.isPending}
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Proposed Rate */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Proposed Rate (EGP) *
                </label>
                <input
                  type="number"
                  value={formData.proposedRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, proposedRate: e.target.value }))}
                  className="w-full px-4 py-3 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="Enter your proposed rate"
                  min="1"
                  step="0.01"
                  required
                  disabled={submitBidMutation.isPending}
                />
                <p className="text-sm text-gray-400 mt-1">
                  Enter your total project cost or hourly rate
                </p>
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Estimated Timeline *
                </label>
                <input
                  type="text"
                  value={formData.timeline}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeline: e.target.value }))}
                  className="w-full px-4 py-3 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., 2 weeks, 1 month, 3-5 business days"
                  required
                  disabled={submitBidMutation.isPending}
                />
              </div>

              {/* Enhanced Milestone Proposal Toggle */}
              <div className="bg-purple-800/20 rounded-lg p-4 border border-purple-700/30">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="hasMilestoneProposal"
                    checked={hasMilestoneProposal}
                    onChange={(e) => setHasMilestoneProposal(e.target.checked)}
                    className="w-4 h-4 text-purple-600 bg-blue-800/50 border-purple-600 rounded focus:ring-purple-500"
                    disabled={submitBidMutation.isPending}
                  />
                  <label htmlFor="hasMilestoneProposal" className="text-white font-medium">
                    Include Milestone Breakdown Proposal
                  </label>
                </div>
                <p className="text-gray-300 text-sm mb-2">
                  Propose a custom milestone structure for this project. Milestone payments must sum exactly to your proposed rate with precise calculations.
                </p>
                <div className="text-xs text-purple-300 bg-purple-900/30 rounded p-2">
                  <strong>Enhanced Math Validation:</strong> Our system uses precise cent-based calculations to ensure milestone payments sum exactly to your proposed rate, preventing rounding errors and budget discrepancies.
                </div>
              </div>

              {/* Enhanced Milestone Proposals */}
              {hasMilestoneProposal && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Milestone Breakdown</h3>
                    <div className="text-sm">
                      <span className="text-gray-400">Total: </span>
                      <span className={`font-semibold ${
                        Math.abs(milestoneTotal - proposedRate) <= 0.01 && proposedRate > 0 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {milestoneTotal.toFixed(2)} EGP
                      </span>
                      {proposedRate > 0 && (
                        <span className="text-gray-400"> / {proposedRate.toFixed(2)} EGP</span>
                      )}
                    </div>
                  </div>

                  {milestones.map((milestone, index) => (
                    <div key={index} className="bg-blue-800/20 rounded-xl p-4 border border-blue-700/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium">Milestone {index + 1}</h4>
                        <div className="flex items-center gap-2">
                          {milestones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMilestone(index)}
                              className="text-red-400 hover:text-red-300 transition-colors text-sm"
                              disabled={submitBidMutation.isPending}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">
                            Title *
                          </label>
                          <input
                            type="text"
                            value={milestone.title}
                            onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                            className="w-full px-3 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                            placeholder="e.g., Initial Concepts"
                            disabled={submitBidMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">
                            Payment Amount (EGP) *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={milestone.paymentAmount}
                              onChange={(e) => updateMilestone(index, 'paymentAmount', e.target.value)}
                              className="w-full px-3 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              disabled={submitBidMutation.isPending}
                            />
                            <div className="absolute right-3 top-2 text-xs text-gray-400">
                              {calculateMilestonePercentage(milestone.paymentAmount).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-gray-300 text-xs font-medium mb-1">
                            Description *
                          </label>
                          <textarea
                            value={milestone.description}
                            onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none text-sm"
                            placeholder="Describe what will be delivered in this milestone..."
                            disabled={submitBidMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">
                            Deliverable Requirements *
                          </label>
                          <textarea
                            value={milestone.deliverableRequirements}
                            onChange={(e) => updateMilestone(index, 'deliverableRequirements', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none text-sm"
                            placeholder="Specific deliverables expected..."
                            disabled={submitBidMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">
                            Estimated Duration *
                          </label>
                          <input
                            type="text"
                            value={milestone.estimatedDuration}
                            onChange={(e) => updateMilestone(index, 'estimatedDuration', e.target.value)}
                            className="w-full px-3 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 text-sm"
                            placeholder="e.g., 1 week, 3 days"
                            disabled={submitBidMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="flex-1 px-4 py-2 bg-purple-700/50 hover:bg-purple-600/50 text-white font-medium rounded-lg transition-colors border border-purple-600/30 flex items-center justify-center gap-2"
                      disabled={submitBidMutation.isPending}
                    >
                      <span>+</span>
                      Add Milestone
                    </button>
                    
                    {proposedRate > 0 && milestones.length > 0 && (
                      <button
                        type="button"
                        onClick={autoDistributeRemainingBudget}
                        className="px-4 py-2 bg-green-700/50 hover:bg-green-600/50 text-white font-medium rounded-lg transition-colors border border-green-600/30 text-sm"
                        disabled={submitBidMutation.isPending}
                      >
                        Auto-Balance
                      </button>
                    )}
                  </div>

                  {/* Enhanced Milestone Validation Summary */}
                  {proposedRate > 0 && (
                    <div className={`p-3 rounded-lg border ${
                      milestoneValidation.isValid 
                        ? 'bg-green-800/20 border-green-700/30' 
                        : 'bg-red-800/20 border-red-700/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={milestoneValidation.isValid ? 'text-green-400' : 'text-red-400'}>
                          {milestoneValidation.isValid ? '✓' : '⚠️'}
                        </span>
                        <span className="text-white font-medium text-sm">
                          Enhanced Milestone Budget Validation
                        </span>
                      </div>
                      {milestoneValidation.isValid ? (
                        <div className="text-green-300 text-xs space-y-1">
                          <p>✓ Milestone breakdown is mathematically accurate</p>
                          <p>✓ Payments sum exactly to your proposed rate</p>
                          <p>✓ No rounding errors or budget discrepancies</p>
                        </div>
                      ) : (
                        <div className="text-red-300 text-xs space-y-1">
                          {milestoneValidation.errors.slice(0, 3).map((error, index) => (
                            <p key={index}>• {error}</p>
                          ))}
                          {milestoneValidation.errors.length > 3 && (
                            <p>• And {milestoneValidation.errors.length - 3} more issues...</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Cover Letter */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Cover Letter *
                </label>
                <textarea
                  value={formData.coverLetter}
                  onChange={(e) => setFormData(prev => ({ ...prev, coverLetter: e.target.value }))}
                  rows={5}
                  className="w-full px-4 py-3 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Explain why you're the perfect fit for this project. Include your relevant experience, approach, and what makes you stand out..."
                  required
                  disabled={submitBidMutation.isPending}
                />
              </div>

              {/* Portfolio Links */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Portfolio Links
                </label>
                <p className="text-sm text-gray-400 mb-3">
                  Share links to your best work that's relevant to this project
                </p>
                
                {formData.portfolioLinks.map((link, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updatePortfolioLink(index, e.target.value)}
                      className="flex-1 px-4 py-2 bg-blue-800/50 border border-blue-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="https://your-portfolio-link.com"
                      disabled={submitBidMutation.isPending}
                    />
                    {formData.portfolioLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePortfolioLink(index)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        disabled={submitBidMutation.isPending}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addPortfolioLink}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors disabled:opacity-50"
                  disabled={submitBidMutation.isPending}
                >
                  + Add another link
                </button>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  disabled={submitBidMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitBidMutation.isPending || (hasMilestoneProposal && !milestoneValidation.isValid)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitBidMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Submitting...
                    </>
                  ) : (
                    'Submit Bid'
                  )}
                </button>
              </div>
            </form>

            {/* Enhanced Tips */}
            <div className="mt-6 p-4 bg-blue-800/30 rounded-lg border border-blue-700/30">
              <h4 className="text-white font-medium mb-2">💡 Tips for a winning bid:</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Be specific about your approach and methodology</li>
                <li>• Include relevant examples from your portfolio</li>
                <li>• Explain your pricing and what's included</li>
                <li>• Show enthusiasm for the project</li>
                {hasMilestoneProposal && (
                  <>
                    <li>• Ensure milestone payments sum exactly to your proposed rate</li>
                    <li>• Use the Auto-Balance button to distribute remaining budget</li>
                    <li>• Our enhanced math validation prevents budget discrepancies</li>
                  </>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BidModal;
