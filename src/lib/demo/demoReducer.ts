import { DemoState, DemoEvent } from './initDemoState';

export type DemoAction =
  | { type: 'TRANSFER_CHIP'; chipStateId: string; toPlayerId: string | null }
  | { type: 'NEXT_HOLE' }
  | { type: 'END_GAME' };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'TRANSFER_CHIP': {
      const chipState = state.chipStates.find((cs) => cs.id === action.chipStateId);
      if (!chipState) return state;

      const chipDef = state.chipDefs.find((d) => d.id === chipState.chip_definition_id);
      const fromName = chipState.holder_player_id
        ? (state.players.find((p) => p.id === chipState.holder_player_id)?.name ?? '場')
        : '場';
      const toName = action.toPlayerId
        ? (state.players.find((p) => p.id === action.toPlayerId)?.name ?? '？')
        : '場';

      const description = chipDef
        ? `${chipDef.name}: ${fromName} → ${toName}`
        : `${fromName} → ${toName}`;

      const newEvent: DemoEvent = {
        id: crypto.randomUUID(),
        description,
        createdAt: new Date().toISOString(),
      };

      const newChipStates = state.chipStates.map((cs) =>
        cs.id === action.chipStateId
          ? { ...cs, holder_player_id: action.toPlayerId, updated_at: new Date().toISOString() }
          : cs
      );

      return {
        ...state,
        chipStates: newChipStates,
        events: [newEvent, ...state.events],
      };
    }

    case 'NEXT_HOLE': {
      if (state.currentHole >= state.totalHoles) {
        return { ...state, status: 'finished' };
      }
      return { ...state, currentHole: state.currentHole + 1 };
    }

    case 'END_GAME': {
      return { ...state, status: 'finished' };
    }

    default:
      return state;
  }
}
