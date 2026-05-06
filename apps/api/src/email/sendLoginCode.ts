import { env } from '../env';

export async function sendLoginCodeEmail(input: {
  email: string;
  code: string;
}): Promise<void> {
  if (env.EMAIL_MODE === 'console') {
    console.log('');
    console.log('==============================================');
    console.log(' ILYA LOGIN CODE');
    console.log(` Email: ${input.email}`);
    console.log(` Code:  ${input.code}`);
    console.log('==============================================');
    console.log('');
    return;
  }

  // Resend will be wired in a later phase after local auth works.
  throw new Error('EMAIL_MODE=resend is not implemented yet. Use EMAIL_MODE=console locally.');
}
