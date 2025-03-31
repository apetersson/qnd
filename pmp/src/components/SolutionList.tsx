import { Board } from "../models/Board";

export interface Solution {
  marketBonus: number;
  foodBonus: number;
  iteration: number;
  boardSnapshot: Board;
  history: string[];
}

interface SolutionListProps {
  solutions: Solution[];
  onSolutionSelect: (solution: Solution | null) => void;
}

const SolutionList: React.FC<SolutionListProps> = ({solutions, onSolutionSelect}) => {
  // Reverse the solutions to show most recent first.
  const reversedSolutions = solutions.slice().reverse();

  return (
    <div style={{display: 'flex', flexDirection: 'row', gap: '10px', marginTop: '10px', overflowX: 'auto'}}>
      {reversedSolutions.map((sol, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center',
            minWidth: '80px',
            cursor: 'pointer'
          }}
          onMouseEnter={() => onSolutionSelect(sol)}
          onMouseLeave={() => onSolutionSelect(null)}
          onClick={() =>
            onSolutionSelect(sol)
          }
        >
          <div style={{fontSize: '18px', fontWeight: 'bold'}}>{sol.marketBonus}</div>
          <div style={{fontSize: '12px'}}>Food: {sol.foodBonus}</div>
        </div>
      ))}
    </div>
  );
};

export default SolutionList;
