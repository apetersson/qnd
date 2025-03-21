// Filename: ./components/SolutionList.tsx

import React from 'react';

interface Solution {
  marketBonus: number;
  foodBonus: number;
  iteration: number;
}

interface SolutionListProps {
  solutions: Solution[];
}

const SolutionList: React.FC<SolutionListProps> = ({solutions}) => {
  // Reverse the solutions list to show the most recent solutions first.
  const reversedSolutions = solutions.slice().reverse();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        marginTop: '10px',
        overflowX: 'auto',
      }}
    >
      {reversedSolutions.map((sol, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center',
            minWidth: '80px',
          }}
        >
          <div style={{fontSize: '18px', fontWeight: 'bold'}}>
            {sol.marketBonus}
          </div>
          <div style={{fontSize: '12px'}}>Food: {sol.foodBonus}</div>
        </div>
      ))}
    </div>
  );
};

export default SolutionList;
