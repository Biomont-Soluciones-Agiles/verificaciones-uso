import { makeStyles, tokens } from '@fluentui/react-components';

/** Estilos compartidos por los bloques de respuesta del editor de entrevistas. */
export const useEstilosRespuesta = makeStyles({
  respuesta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  insignias: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, alignItems: 'center' },
  espaciador: { marginLeft: 'auto' },
});
