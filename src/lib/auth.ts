import { type NextAuthOptions } from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';
import mysql from 'mysql2/promise';

/** Lightweight direct pool for auth callbacks — avoids server-only import */
const authPool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_DATABASE || 'tender_trakr',
  waitForConnections: true,
  connectionLimit: 5,
});

type DbUser = { id: number; email: string; name: string; role: string };

async function findUser(email: string): Promise<DbUser | null> {
  const [rows] = await authPool.query<mysql.RowDataPacket[]>(
    'SELECT id, email, name, role FROM users WHERE email = ?', [email]
  );
  return (rows[0] as DbUser) ?? null;
}

async function createUser(name: string, email: string): Promise<DbUser> {
  const [result] = await authPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO users (name, email, role) VALUES (?, ?, ?)',
    [name, email, 'viewer']
  );
  return { id: result.insertId, email, name, role: 'viewer' };
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId:     process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId:     process.env.AZURE_AD_TENANT_ID,
      authorization: {
        params: { scope: 'openid profile email offline_access Mail.Send' },
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user, account, profile }) {
      try {
        if (account?.provider === 'azure-ad' && user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const email = (profile as any)?.upn || profile?.email || user.email || '';
          const name  = profile?.name || user.name || email;

          if (!email) throw new Error('No email returned from Azure AD');
          if (!email.endsWith('@glasswing.in')) {
            throw new Error('Access restricted to @glasswing.in accounts.');
          }

          let dbUser = await findUser(email);
          if (!dbUser) dbUser = await createUser(name as string, email);

          token.id               = String(dbUser.id);
          token.email            = dbUser.email;
          token.name             = dbUser.name;
          token.role             = dbUser.role;
          token.provider         = 'azure-ad';
          token.accessToken      = account.access_token;
          token.refreshToken     = account.refresh_token;
          token.accessTokenExpires = Date.now() + 55 * 60 * 1000; // 55 min (Azure tokens expire in 60 min)
        }

        // Refresh Azure AD token when expired
        if (
          token.provider === 'azure-ad' &&
          token.refreshToken &&
          typeof token.accessTokenExpires === 'number' &&
          Date.now() >= token.accessTokenExpires
        ) {
          const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id:     process.env.AZURE_AD_CLIENT_ID!,
              client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
              grant_type:    'refresh_token',
              refresh_token: token.refreshToken as string,
              scope:         'openid profile email offline_access Mail.Send',
            }),
          });
          if (res.ok) {
            const refreshed = await res.json();
            token.accessToken = refreshed.access_token;
            token.accessTokenExpires = Date.now() + (refreshed.expires_in - 300) * 1000;
            token.refreshToken = refreshed.refresh_token ?? token.refreshToken;
          } else {
            token.error = 'RefreshAccessTokenError';
          }
        }

        return token;
      } catch (err) {
        console.error('[auth][jwt]', err);
        return { ...token, error: 'JWTError' };
      }
    },

    async session({ session, token }) {
      if (token.id && token.email && token.role) {
        session.user = {
          id:    token.id as string,
          email: token.email as string,
          name:  token.name as string ?? '',
          role:  token.role as string,
          image: null,
        };
        session.accessToken = token.accessToken as string | undefined;
        session.error = token.error as string | undefined;
      } else {
        session.error = (token.error as string) || 'SessionMissingFields';
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
};
