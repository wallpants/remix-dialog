import {
  type ActionFunction,
  type LoaderFunction,
  type SerializeFrom,
} from "@remix-run/node";
import { useRevalidator } from "@remix-run/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type DialogContext<
  L extends LoaderFunction = LoaderFunction,
  A extends ActionFunction = ActionFunction,
> = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  loaderData: SerializeFrom<L>;
  actionData: SerializeFrom<A> | undefined;
  refreshLoaderData: () => void;
  onSubmit: (values: unknown) => void;
  error: string | null;
};

const dialogContext = createContext<DialogContext | null>(null);

export const useDialogWrapper = <
  L extends LoaderFunction = never,
  A extends ActionFunction = never,
>() => {
  const context = useContext<DialogContext<L, A> | null>(dialogContext);
  if (context === null) throw Error("useDialogWrapper missing Provider");
  return context;
};

export const RouteDialogWrapper = <
  L extends LoaderFunction,
  A extends ActionFunction,
>({
  children,
  url: _url,
  open,
  setOpen,
}: {
  children: ReactNode;
  url: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const openRef = useRef(open);
  const revalidator = useRevalidator();
  const [loaderData, setLoaderData] = useState<SerializeFrom<L>>();
  const [actionData, setActionData] = useState<SerializeFrom<A>>();
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const url = `${_url}?${refreshCount}`;

  useEffect(() => {
    if (!open || !_url) {
      // timeout to allow animations to run
      setTimeout(() => setLoaderData(undefined), 100);
      setActionData(undefined);
      if (!open && openRef.current) {
        // if it was open and is closing
        revalidator.revalidate();
      }
    } else {
      fetch(url, {
        headers: { Accept: "application/json" },
      })
        .then((res) => res.json())
        .then((json) => {
          setLoaderData(json as SerializeFrom<L>);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) setError(err.message);
          console.error(err);
        });
    }
    openRef.current = open;
  }, [_url, open, refreshCount, revalidator, url]);

  const onSubmit = useCallback(
    (values: unknown) => {
      fetch(url, {
        method: "post",
        body: JSON.stringify(values),
      })
        .then((res) => res.json())
        .then((json: unknown) => {
          const newActionData = json;
          setActionData(newActionData as typeof actionData);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) setError(err.message);
          console.error(err);
        });
    },
    [url],
  );

  const refreshLoaderData = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  if (loaderData === undefined) return null;

  return (
    <dialogContext.Provider
      value={{
        open,
        setOpen,
        loaderData,
        actionData,
        refreshLoaderData,
        onSubmit,
        error,
      }}
    >
      {children}
    </dialogContext.Provider>
  );
};
