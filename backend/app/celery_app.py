try:
    from celery import Celery
except ImportError:  # pragma: no cover - runtime fallback
    Celery = None

if Celery is not None:
    celery_app = Celery(
        "dataviz_worker",
        broker="memory://",
        backend="cache+memory://",
        include=[
            "app.agents.eda_agent",
            "app.agents.chart_agent",
            "app.agents.insight_agent",
            "app.agents.file_processor",
        ],
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_always_eager=True,
        task_eager_propagates=True,
        task_time_limit=300,
        worker_prefetch_multiplier=1,
        result_expires=3600,
    )

    celery_app.conf.task_routes = {
        "app.agents.eda_agent.*": {"queue": "analysis"},
        "app.agents.chart_agent.*": {"queue": "charts"},
        "app.agents.insight_agent.*": {"queue": "insights"},
    }
else:  # pragma: no cover - runtime fallback
    class _FallbackCeleryApp:
        def task(self, *args, **kwargs):
            def decorator(func):
                def wrapper(*call_args, **call_kwargs):
                    import inspect

                    params = list(inspect.signature(func).parameters)
                    if kwargs.get("bind", False) and params and params[0] in {"self", "cls"}:
                        if len(call_args) == len(params) - 1:
                            call_args = (None,) + call_args
                    return func(*call_args, **call_kwargs)

                wrapper.apply_async = lambda *apply_args, **apply_kwargs: wrapper(*apply_args, **apply_kwargs)
                wrapper.delay = lambda *delay_args, **delay_kwargs: wrapper(*delay_args, **delay_kwargs)
                return wrapper

            return decorator

        def send_task(self, *args, **kwargs):
            return None

    celery_app = _FallbackCeleryApp()
