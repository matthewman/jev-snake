export const DIRECTIONS = [
  {id:'up',label:'Up',arrow:'↑',column:1,row:0},
  {id:'right',label:'Right',arrow:'→',column:2,row:1},
  {id:'down',label:'Down',arrow:'↓',column:1,row:1},
  {id:'left',label:'Left',arrow:'←',column:0,row:1},
];

// Display recorded relative choices as keyboard directions at observation time.
// Only reverse is disabled. Moves into walls or body remain selectable choices.
export function arrowChoices(state) {
  return DIRECTIONS.map((direction,heading)=>{
    const action=['straight','right',null,'left'][(heading-state.heading+4)%4];
    return {...direction,action,disabled:action===null};
  });
}
