import React from "react";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import styled from "styled-components";
import MainPage from "./pages/MainPage";
import ArticlePage from "./pages/ArticlePage";
import GlobalStyle from "./styles/GlobalStyle";

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #0a0a0a;
  color: #ffffff;
`;

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분 동안 데이터를 fresh로 간주
      gcTime: 10 * 60 * 1000, // 10분 후 가비지 컬렉션 (이전 cacheTime)
      retry: 1, // 실패시 1번만 재시도
      refetchOnWindowFocus: false, // 윈도우 포커스시 재요청 비활성화
    },
  },
});

// 레이아웃 컴포넌트
const Layout = () => {
  return (
    <AppContainer>
      <Outlet />
    </AppContainer>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <MainPage />,
      },
      {
        path: "article/:articleId",
        element: <ArticlePage />,
      },
    ],
  },
]);

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <GlobalStyle />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
