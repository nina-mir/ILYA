import { useEffect } from 'react';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { useStore } from './store';
import { useNavigate } from './hooks/useNavigate';
import EnterPage from './pages/EnterPage';
import LibraryPage from './pages/LibraryPage';
import FilePage from './pages/FilePage';
import EditorPage from './pages/EditorPage';

export default function App() {
  return (
    <WouterRouter>
      <AppRouter />
    </WouterRouter>
  );
}

function AppRouter() {
  const user = useStore((s) => s.user);
  const authReady = useStore((s) => s.authReady);
  const loadMe = useStore((s) => s.loadMe);
  const navigate = useNavigate();
  const [location] = useLocation();

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!authReady) return;
    const isEnter = location === '/enter';
    if (!user && !isEnter) {
      navigate('/enter', true);
    } else if (user && isEnter) {
      navigate('/', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, location]);

  if (!authReady) {
    return <div className="page" aria-hidden="true" />;
  }

  return (
    <Switch>
      <Route path="/enter" component={EnterPage} />
      <Route path="/" component={LibraryPage} />
      <Route path="/file" component={FilePage} />
      <Route path="/book/:id">
        {(params) => <EditorPage id={params.id} />}
      </Route>
      <Route>
        <Redirect to="/" replace />
      </Route>
    </Switch>
  );
}

// import { useEffect } from 'react';
// import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
// import { useStore } from './store';
// import { useNavigate } from './hooks/useNavigate';
// import EnterPage from './pages/EnterPage';
// import LibraryPage from './pages/LibraryPage';
// import FilePage from './pages/FilePage';
// import EditorPage from './pages/EditorPage';

// export default function App() {
//   return (
//     <WouterRouter>
//       <AppRouter />
//     </WouterRouter>
//   );
// }

// function AppRouter() {
//   const user = useStore((s) => s.user);
//   const authReady = useStore((s) => s.authReady);
//   const navigate = useNavigate();
//   const [location] = useLocation();

//   // Redirect anonymous visitors away from protected routes once auth has
//   // settled. /enter is the only public route. The masthead settle animation
//   // on the entry screen depends on landing there fresh, so we want the
//   // redirect to use the same view-transition fade that internal navigation
//   // uses.
//   useEffect(() => {
//     if (!authReady) return;
//     const isEnter = location === '/enter';
//     if (!user && !isEnter) {
//       navigate('/enter', true);
//     } else if (user && isEnter) {
//       navigate('/', true);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [authReady, user, location]);

//   // Until auth resolves, render Linen Cream and nothing else. No spinner —
//   // the spec forbids them. The first paint is the cream surface; whichever
//   // route resolves takes over with the route-fade.
//   if (!authReady) {
//     return <div className="page" aria-hidden="true" />;
//   }

//   return (
//     <Switch>
//       <Route path="/enter" component={EnterPage} />
//       <Route path="/" component={LibraryPage} />
//       <Route path="/file" component={FilePage} />
//       <Route path="/book/:id">
//         {(params) => <EditorPage id={params.id} />}
//       </Route>
//       <Route>
//         <Redirect to="/" replace />
//       </Route>
//     </Switch>
//   );
// }
