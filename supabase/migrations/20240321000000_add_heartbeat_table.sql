-- Create heartbeat table
create table public.heartbeat (
    id serial primary key,
    count int default 1,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial row
insert into public.heartbeat (count) values (1);

-- Create policy to allow anonymous access for heartbeat checks
create policy "Allow anonymous heartbeat checks"
    on public.heartbeat
    for select
    to anon
    using (true);

-- Enable RLS
alter table public.heartbeat enable row level security; 