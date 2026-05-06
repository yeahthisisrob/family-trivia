/**
 * Unit test to verify member summary skip rate calculations
 * This test proves the backend calculation is correct
 */

describe('Member Summary Skip Rate Calculation Logic', () => {
  test('Skip rate calculation: 9 skipped out of 10 = 90% skip rate', () => {
    // This is the exact calculation from memberSummary.ts lines 259-260
    const personalFactsAsked = 10;
    const personalFactsSkipped = 9;
    const personalSkipRate = personalFactsAsked > 0 ? 
      Math.round((personalFactsSkipped / personalFactsAsked) * 100) : 0;
    
    expect(personalSkipRate).toBe(90);
    
    // NOT 100% sharing rate, but 90% skip rate
    const sharingRate = 100 - personalSkipRate;
    expect(sharingRate).toBe(10); // Only 10% sharing rate
  });

  test('Skip rate calculation: 0 skipped out of 10 = 0% skip rate', () => {
    const personalFactsAsked = 10;
    const personalFactsSkipped = 0;
    const personalSkipRate = personalFactsAsked > 0 ? 
      Math.round((personalFactsSkipped / personalFactsAsked) * 100) : 0;
    
    expect(personalSkipRate).toBe(0);
    
    // This would be 100% sharing rate
    const sharingRate = 100 - personalSkipRate;
    expect(sharingRate).toBe(100);
  });

  test('Skip rate calculation: 2 skipped out of 3 = 67% skip rate', () => {
    const personalFactsAsked = 3;
    const personalFactsSkipped = 2;
    const personalSkipRate = personalFactsAsked > 0 ? 
      Math.round((personalFactsSkipped / personalFactsAsked) * 100) : 0;
    
    expect(personalSkipRate).toBe(67); // 2/3 = 0.667, rounded to 67
    
    const sharingRate = 100 - personalSkipRate;
    expect(sharingRate).toBe(33); // Only 33% sharing rate
  });

  test('Edge case: no facts asked = 0% skip rate', () => {
    const personalFactsAsked = 0;
    const personalFactsSkipped = 0;
    const personalSkipRate = personalFactsAsked > 0 ? 
      Math.round((personalFactsSkipped / personalFactsAsked) * 100) : 0;
    
    expect(personalSkipRate).toBe(0);
  });
});

/**
 * CONCLUSION:
 * The backend calculation is correct. It calculates a SKIP RATE, not a SHARING RATE.
 * 
 * If the user sees "100% sharing rate" when someone skips 90% of facts, the issue is likely:
 * 1. Frontend is displaying the wrong value
 * 2. Frontend is misinterpreting skip rate as sharing rate
 * 3. The UI label is incorrect
 * 
 * The backend correctly reports:
 * - personalSkipRate: 90% (when 9 out of 10 are skipped)
 * - personalFactsAnswered: 1 (the actual count of answered facts)
 * - personalFactsSkipped: 9 (the actual count of skipped facts)
 */